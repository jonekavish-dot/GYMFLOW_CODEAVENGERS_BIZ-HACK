import re
from datetime import timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from ..deps import DB, AdminUser, MemberUser
from ..models import (
    Attendance, ClassBooking, GymClass, Member, Payment, Plan, RefreshToken, Slot, SlotBooking, User,
)
from ..schemas import (
    MemberCreate, MemberOut, MemberSelfUpdate, MemberUpdate, RenewIn, ResetPasswordIn,
)
from ..security import hash_password
from ..timeutil import add_months, end_of_local_day, local_midnight, utcnow

router = APIRouter(prefix="/members", tags=["members"])


def _next_custom_id(db, prefix: str = "ASF") -> str:
    highest = 0
    for cid in db.scalars(select(Member.custom_id)):
        digits = re.sub(r"\D", "", cid or "")
        if digits:
            highest = max(highest, int(digits))
    return f"{prefix}{highest + 1:03d}"


def _get_member(db, user_id: int) -> Member:
    member = db.scalar(select(Member).options(joinedload(Member.user)).where(Member.user_id == user_id))
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found.")
    return member


def _get_plan(db, plan_id: int) -> Plan:
    plan = db.get(Plan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found.")
    return plan


@router.get("/me", response_model=MemberOut)
def my_membership(user: MemberUser, db: DB):
    return _get_member(db, user.id)


@router.patch("/me", response_model=MemberOut)
def update_my_membership(body: MemberSelfUpdate, user: MemberUser, db: DB):
    """Members can only touch their own goals and phone — never plan, expiry or category."""
    member = _get_member(db, user.id)
    if body.goals is not None:
        member.goals = body.goals.strip()
    if body.phone is not None:
        member.phone = body.phone.strip()
    db.commit()
    return member


@router.get("", response_model=list[MemberOut])
def list_members(_: AdminUser, db: DB):
    return db.scalars(select(Member).options(joinedload(Member.user)).order_by(Member.expiry_date)).all()


@router.post("", response_model=MemberOut, status_code=201)
def register_member(body: MemberCreate, _: AdminUser, db: DB):
    plan = _get_plan(db, body.plan_id)
    if not plan.active:
        raise HTTPException(status_code=400, detail="That plan is no longer offered.")
    if db.scalar(select(User.id).where(User.email == body.email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    custom_id = body.custom_id.strip().upper() or _next_custom_id(db)
    if db.scalar(select(Member.user_id).where(Member.custom_id == custom_id)):
        raise HTTPException(status_code=409, detail=f"Member ID {custom_id} is already taken.")

    start = local_midnight(body.start_date)
    expiry = end_of_local_day(
        add_months(start, body.months) if body.months else start + timedelta(days=plan.duration_days)
    )
    user = User(email=body.email, name=body.name.strip(), password_hash=hash_password(body.password), role="member")
    try:
        db.add(user)
        db.flush()
        member = Member(
            user_id=user.id, custom_id=custom_id, phone=body.phone.strip(), plan_id=plan.id, plan_name=plan.name,
            start_date=start, expiry_date=expiry, goals=body.goals.strip(), exercise_category=body.exercise_category,
            notes=body.notes.strip(), method=body.method, paid=body.paid,
        )
        db.add(member)
        if body.paid > 0:
            db.add(Payment(
                user_id=user.id, member_name=user.name, custom_id=custom_id, amount=body.paid, method=body.method,
                months=body.months or max(1, round(plan.duration_days / 30)), kind="join",
                plan_name=plan.name, expiry_after=expiry,
            ))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That email or member ID is already in use.")
    member.user = user
    return member


@router.get("/{user_id}", response_model=MemberOut)
def get_member(user_id: int, _: AdminUser, db: DB):
    return _get_member(db, user_id)


@router.patch("/{user_id}", response_model=MemberOut)
def update_member(user_id: int, body: MemberUpdate, _: AdminUser, db: DB):
    member = _get_member(db, user_id)
    if body.name is not None:
        member.user.name = body.name.strip()
    if body.phone is not None:
        member.phone = body.phone.strip()
    if body.exercise_category is not None:
        member.exercise_category = body.exercise_category
    if body.notes is not None:
        member.notes = body.notes.strip()
    db.commit()
    return member


@router.post("/{user_id}/renew", response_model=MemberOut)
def renew_membership(user_id: int, body: RenewIn, _: AdminUser, db: DB):
    """Expired memberships restart from today; active ones stack on top of the remaining time."""
    member = _get_member(db, user_id)
    plan = _get_plan(db, body.plan_id)
    now = utcnow()
    base = now if member.expiry_date <= now else member.expiry_date
    member.expiry_date = end_of_local_day(add_months(base, body.months))
    member.plan_id, member.plan_name = plan.id, plan.name
    member.paid += body.fee
    member.method = body.method
    member.renewal_count += 1
    db.add(Payment(
        user_id=member.user_id, member_name=member.user.name, custom_id=member.custom_id, amount=body.fee,
        method=body.method, months=body.months, kind="renewal", plan_name=plan.name, expiry_after=member.expiry_date,
    ))
    db.commit()
    return member


@router.post("/{user_id}/reset-password", status_code=204)
def reset_password(user_id: int, body: ResetPasswordIn, _: AdminUser, db: DB):
    member = _get_member(db, user_id)
    member.user.password_hash = hash_password(body.new_password)
    db.execute(
        update(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
    db.commit()


@router.delete("/{user_id}", status_code=204)
def delete_member(user_id: int, _: AdminUser, db: DB):
    """Removes the member and their login. Payments are kept (they're the revenue record)."""
    member = _get_member(db, user_id)
    # Free the seats they were holding before their booking rows disappear with them.
    for cb in db.scalars(select(ClassBooking).where(ClassBooking.user_id == user_id)):
        db.execute(update(GymClass).where(GymClass.id == cb.class_id, GymClass.booked_count > 0)
                   .values(booked_count=GymClass.booked_count - 1))
    for sb in db.scalars(select(SlotBooking).where(SlotBooking.user_id == user_id)):
        db.execute(update(Slot).where(Slot.id == sb.slot_id, Slot.booked_count > 0)
                   .values(booked_count=Slot.booked_count - 1))
    db.execute(delete(Attendance).where(Attendance.kind == "member", Attendance.person_id == user_id))
    db.delete(member.user)
    db.commit()
