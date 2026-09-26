from datetime import datetime

from fastapi import APIRouter, HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError

from ..deps import DB, ActiveMember, AdminUser, CurrentUser, MemberUser
from ..models import ClassBooking, GymClass
from ..schemas import ClassCreate, ClassOut
from ..timeutil import UTC, gym_tz, utcnow

router = APIRouter(prefix="/classes", tags=["classes"])


def aware(dt: datetime) -> datetime:
    """Datetime-local inputs arrive without a zone; they mean the gym's local time."""
    return dt.replace(tzinfo=gym_tz()).astimezone(UTC) if dt.tzinfo is None else dt.astimezone(UTC)


@router.get("", response_model=list[ClassOut])
def list_classes(user: CurrentUser, db: DB):
    booked = set(db.scalars(select(ClassBooking.class_id).where(ClassBooking.user_id == user.id)))
    rows = db.scalars(select(GymClass).where(GymClass.start_at >= utcnow()).order_by(GymClass.start_at)).all()
    return [ClassOut.model_validate(c).model_copy(update={"booked": c.id in booked}) for c in rows]


@router.post("", response_model=ClassOut, status_code=201)
def create_class(body: ClassCreate, _: AdminUser, db: DB):
    cls = GymClass(
        title=body.title.strip(), trainer=body.trainer.strip(), start_at=aware(body.start_at),
        duration_min=body.duration_min, capacity=body.capacity, tags=[t.strip() for t in body.tags if t.strip()],
    )
    db.add(cls)
    db.commit()
    return cls


@router.delete("/{class_id}", status_code=204)
def delete_class(class_id: int, _: AdminUser, db: DB):
    cls = db.get(GymClass, class_id)
    if cls is None:
        raise HTTPException(status_code=404, detail="Class not found.")
    db.execute(delete(ClassBooking).where(ClassBooking.class_id == class_id))
    db.delete(cls)
    db.commit()


@router.post("/{class_id}/book", status_code=201)
def book_class(class_id: int, member: ActiveMember, db: DB):
    cls = db.get(GymClass, class_id)
    if cls is None:
        raise HTTPException(status_code=404, detail="Class no longer exists.")
    if cls.start_at <= utcnow():
        raise HTTPException(status_code=409, detail="This class has already started.")
    if db.scalar(select(ClassBooking.id).where(ClassBooking.class_id == class_id, ClassBooking.user_id == member.user_id)):
        raise HTTPException(status_code=409, detail="You already booked this class.")

    # One conditional UPDATE: the seat is taken only if one is still free, so two members
    # racing for the last seat can't both win.
    taken = db.execute(
        update(GymClass).where(GymClass.id == class_id, GymClass.booked_count < GymClass.capacity)
        .values(booked_count=GymClass.booked_count + 1)
    )
    if taken.rowcount == 0:
        db.rollback()
        raise HTTPException(status_code=409, detail="Class is full.")
    db.add(ClassBooking(class_id=class_id, user_id=member.user_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="You already booked this class.")
    return {"ok": True}


@router.delete("/{class_id}/book", status_code=204)
def cancel_class_booking(class_id: int, user: MemberUser, db: DB):
    gone = db.execute(delete(ClassBooking).where(ClassBooking.class_id == class_id, ClassBooking.user_id == user.id))
    if gone.rowcount:
        db.execute(update(GymClass).where(GymClass.id == class_id, GymClass.booked_count > 0)
                   .values(booked_count=GymClass.booked_count - 1))
    db.commit()
