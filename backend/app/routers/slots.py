from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError

from ..deps import DB, ActiveMember, AdminUser, CurrentUser
from ..models import Member, Slot, SlotBooking
from ..schemas import RosterOut, SlotCreate, SlotOut, SlotStatusIn
from ..timeutil import gym_tz, utcnow
from .classes import aware

router = APIRouter(prefix="/slots", tags=["gym slots"])


def _fmt(dt: datetime) -> str:
    return dt.astimezone(gym_tz()).strftime("%a %d %b, %I:%M %p")


@router.get("", response_model=list[SlotOut])
def list_slots(user: CurrentUser, db: DB):
    booked = set(db.scalars(select(SlotBooking.slot_id).where(SlotBooking.user_id == user.id)))
    rows = db.scalars(select(Slot).where(Slot.start_at >= utcnow()).order_by(Slot.start_at)).all()
    return [SlotOut.model_validate(s).model_copy(update={"booked": s.id in booked}) for s in rows]


@router.post("", response_model=SlotOut, status_code=201)
def create_slot(body: SlotCreate, _: AdminUser, db: DB):
    start = aware(body.start_at)
    end = start + timedelta(minutes=body.duration_min)
    trainer = body.trainer.strip()

    # A trainer can't run two slots at once: a new one is only allowed after the current one ends.
    if trainer:
        clash = db.scalar(
            select(Slot).where(Slot.trainer == trainer, Slot.start_at < end, Slot.end_at > start)
        )
        if clash:
            raise HTTPException(status_code=409, detail=(
                f'Time Security Conflict: Trainer "{trainer}" is already booked for "{clash.title}" '
                f"({_fmt(clash.start_at)} – {_fmt(clash.end_at)}). "
                "A new slot can only be booked after that slot has completed."
            ))

    slot = Slot(
        title=body.title.strip(), trainer=trainer, start_at=start, end_at=end, duration_min=body.duration_min,
        capacity=body.capacity, status=body.status, notes=body.notes.strip(),
    )
    db.add(slot)
    db.commit()
    return slot


@router.patch("/{slot_id}", response_model=SlotOut)
def set_status(slot_id: int, body: SlotStatusIn, _: AdminUser, db: DB):
    slot = db.get(Slot, slot_id)
    if slot is None:
        raise HTTPException(status_code=404, detail="Slot not found.")
    slot.status = body.status
    db.commit()
    return slot


@router.delete("/{slot_id}", status_code=204)
def delete_slot(slot_id: int, _: AdminUser, db: DB):
    slot = db.get(Slot, slot_id)
    if slot is None:
        raise HTTPException(status_code=404, detail="Slot not found.")
    db.execute(delete(SlotBooking).where(SlotBooking.slot_id == slot_id))
    db.delete(slot)
    db.commit()


@router.get("/{slot_id}/roster", response_model=list[RosterOut])
def roster(slot_id: int, _: AdminUser, db: DB):
    rows = db.execute(
        select(SlotBooking, Member.custom_id)
        .outerjoin(Member, Member.user_id == SlotBooking.user_id)
        .where(SlotBooking.slot_id == slot_id).order_by(SlotBooking.created_at)
    ).all()
    return [RosterOut(user_id=b.user_id, member_name=b.user.name, custom_id=cid or "", booked_at=b.created_at)
            for b, cid in rows]


@router.post("/{slot_id}/book", status_code=201)
def book_slot(slot_id: int, member: ActiveMember, db: DB):
    slot = db.get(Slot, slot_id)
    if slot is None:
        raise HTTPException(status_code=404, detail="Slot no longer exists.")
    if slot.status == "closed":
        raise HTTPException(status_code=409, detail="This slot is closed for new bookings.")
    if slot.end_at <= utcnow():
        raise HTTPException(status_code=409, detail="This workout slot has already completed.")
    if db.scalar(select(SlotBooking.id).where(SlotBooking.slot_id == slot_id, SlotBooking.user_id == member.user_id)):
        raise HTTPException(status_code=409, detail="You have already booked this slot.")

    clash = db.scalar(
        select(Slot).join(SlotBooking, SlotBooking.slot_id == Slot.id)
        .where(SlotBooking.user_id == member.user_id, Slot.start_at < slot.end_at, Slot.end_at > slot.start_at)
    )
    if clash:
        raise HTTPException(status_code=409, detail=f'Time Conflict: You already have a slot booked ("{clash.title}") at this time.')

    taken = db.execute(
        update(Slot).where(Slot.id == slot_id, Slot.booked_count < Slot.capacity)
        .values(booked_count=Slot.booked_count + 1)
    )
    if taken.rowcount == 0:
        db.rollback()
        raise HTTPException(status_code=409, detail="This slot has reached maximum customer overload (full).")
    db.add(SlotBooking(slot_id=slot_id, user_id=member.user_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="You have already booked this slot.")
    return {"ok": True}


# There is deliberately no member-facing cancel: once booked, a seat is confirmed.
# Admin is the only one who can free it (no-show, booked by mistake).
@router.delete("/{slot_id}/bookings/{user_id}", status_code=204)
def remove_attendee(slot_id: int, user_id: int, _: AdminUser, db: DB):
    gone = db.execute(delete(SlotBooking).where(SlotBooking.slot_id == slot_id, SlotBooking.user_id == user_id))
    if not gone.rowcount:
        raise HTTPException(status_code=404, detail="That member is not booked into this slot.")
    db.execute(update(Slot).where(Slot.id == slot_id, Slot.booked_count > 0).values(booked_count=Slot.booked_count - 1))
    db.commit()
