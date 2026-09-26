import hmac
import secrets

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from ..deps import DB, ActiveMember, AdminUser, CurrentUser, MemberUser
from ..models import Checkin, CheckinSession, Member, User
from ..ratelimit import checkin_limiter
from ..schemas import (
    CheckinOut, CheckinSessionIn, CheckinSessionOut, InsideOut, ManualCheckinIn, SelfCheckinIn,
)
from ..timeutil import utcnow
from datetime import timedelta

router = APIRouter(prefix="/checkin", tags=["check-in"])
SESSION_ID = 1


def _open_checkin(db, user_id: int) -> Checkin | None:
    return db.scalar(
        select(Checkin).where(Checkin.user_id == user_id, Checkin.checked_out_at.is_(None))
        .order_by(Checkin.at.desc()).limit(1)
    )


@router.get("/session", response_model=CheckinSessionOut | None)
def current_session(_: AdminUser, db: DB):
    session = db.get(CheckinSession, SESSION_ID)
    return session if session and session.expires_at > utcnow() else None


@router.post("/session", response_model=CheckinSessionOut, status_code=201)
def generate_session(body: CheckinSessionIn, admin: AdminUser, db: DB):
    """Starts (or replaces) the one active code; whatever was showing before stops working at once."""
    now = utcnow()
    session = db.get(CheckinSession, SESSION_ID) or CheckinSession(id=SESSION_ID)
    session.code = f"{secrets.randbelow(900_000) + 100_000}"
    session.validity_minutes = body.validity_minutes
    session.expires_at = now + timedelta(minutes=body.validity_minutes)
    session.created_by = admin.id
    session.created_at = now
    db.add(session)
    db.commit()
    return session


@router.delete("/session", status_code=204)
def revoke_session(_: AdminUser, db: DB):
    session = db.get(CheckinSession, SESSION_ID)
    if session:
        session.expires_at = utcnow()
        db.commit()


@router.post("/self", response_model=CheckinOut, status_code=201)
def self_checkin(body: SelfCheckinIn, member: ActiveMember, db: DB):
    key = f"user:{member.user_id}"
    checkin_limiter.check(key)

    session = db.get(CheckinSession, SESSION_ID)
    matches = session is not None and hmac.compare_digest(session.code, body.code)
    if not matches:
        checkin_limiter.fail(key)
        raise HTTPException(status_code=400, detail="Wrong code.")
    if session.expires_at <= utcnow():
        raise HTTPException(status_code=400, detail="This code has expired — ask the front desk for the current one.")
    checkin_limiter.clear(key)

    if _open_checkin(db, member.user_id):
        raise HTTPException(status_code=409, detail="You're already checked in.")
    checkin = Checkin(user_id=member.user_id, method=body.method, code_used=body.code)
    db.add(checkin)
    db.commit()
    return checkin


@router.post("/manual", response_model=CheckinOut, status_code=201)
def manual_checkin(body: ManualCheckinIn, _: AdminUser, db: DB):
    """Front-desk override: no code needed."""
    if db.get(Member, body.user_id) is None:
        raise HTTPException(status_code=404, detail="Member not found.")
    if _open_checkin(db, body.user_id):
        raise HTTPException(status_code=409, detail="That member is already checked in.")
    checkin = Checkin(user_id=body.user_id, method="manual")
    db.add(checkin)
    db.commit()
    return checkin


@router.get("/inside", response_model=list[InsideOut])
def inside_now(_: AdminUser, db: DB):
    rows = db.execute(
        select(Checkin, User.name, Member.custom_id)
        .join(User, User.id == Checkin.user_id)
        .outerjoin(Member, Member.user_id == Checkin.user_id)
        .where(Checkin.checked_out_at.is_(None)).order_by(Checkin.at)
    ).all()
    return [InsideOut(id=c.id, user_id=c.user_id, name=name, custom_id=cid or "", method=c.method, at=c.at)
            for c, name, cid in rows]


@router.get("/me/open", response_model=CheckinOut | None)
def my_open_checkin(user: MemberUser, db: DB):
    return _open_checkin(db, user.id)


@router.post("/{checkin_id}/checkout", response_model=CheckinOut)
def checkout(checkin_id: int, user: CurrentUser, db: DB):
    checkin = db.get(Checkin, checkin_id)
    if checkin is None or (user.role != "admin" and checkin.user_id != user.id):
        raise HTTPException(status_code=404, detail="Check-in not found.")
    if checkin.checked_out_at is None:
        checkin.checked_out_at = utcnow()
        db.commit()
    return checkin
