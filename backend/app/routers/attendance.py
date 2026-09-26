from datetime import date as Date
from datetime import timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy import delete, select

from ..deps import DB, ActiveMember, AdminUser, MemberUser
from ..models import Attendance, Checkin, Trainer, User
from ..schemas import AttendanceIn, AttendanceOut, SelfAttendanceIn
from ..timeutil import gym_today, local_midnight

router = APIRouter(prefix="/attendance", tags=["attendance"])


def _upsert(db, day: Date, kind: str, person_id: int, name: str, status: str, exercises: list[str], notes: str = "") -> Attendance:
    row = db.scalar(select(Attendance).where(
        Attendance.date == day, Attendance.kind == kind, Attendance.person_id == person_id))
    if row is None:
        row = Attendance(date=day, kind=kind, person_id=person_id)
        db.add(row)
    row.name, row.status, row.exercises, row.notes = name, status, list(dict.fromkeys(exercises)), notes
    db.commit()
    return row


@router.get("", response_model=list[AttendanceOut])
def day_rows(date: Date, _: AdminUser, db: DB):
    return db.scalars(select(Attendance).where(Attendance.date == date)).all()


@router.get("/recent", response_model=list[AttendanceOut])
def recent(_: AdminUser, db: DB, days: int = 30):
    since = gym_today() - timedelta(days=max(1, min(days, 366)))
    return db.scalars(select(Attendance).where(Attendance.date >= since)).all()


@router.put("", response_model=AttendanceOut)
def mark(body: AttendanceIn, _: AdminUser, db: DB):
    if body.kind == "member":
        person = db.get(User, body.person_id)
        if person is None or person.role != "member":
            raise HTTPException(status_code=404, detail="Member not found.")
        if body.status == "present" and not body.exercises:
            raise HTTPException(status_code=400, detail="Tick at least one exercise before marking present.")
    else:
        person = db.get(Trainer, body.person_id)
        if person is None:
            raise HTTPException(status_code=404, detail="Trainer not found.")
    return _upsert(db, body.date, body.kind, body.person_id, person.name, body.status, body.exercises, body.notes)


@router.delete("", status_code=204)
def clear(date: Date, kind: str, person_id: int, _: AdminUser, db: DB):
    db.execute(delete(Attendance).where(
        Attendance.date == date, Attendance.kind == kind, Attendance.person_id == person_id))
    db.commit()


@router.get("/me", response_model=list[AttendanceOut])
def my_history(user: MemberUser, db: DB):
    return db.scalars(
        select(Attendance).where(Attendance.kind == "member", Attendance.person_id == user.id)
        .order_by(Attendance.date.desc())
    ).all()


@router.get("/me/today", response_model=AttendanceOut | None)
def my_today(user: MemberUser, db: DB):
    return db.scalar(select(Attendance).where(
        Attendance.date == gym_today(), Attendance.kind == "member", Attendance.person_id == user.id))


@router.put("/me/today", response_model=AttendanceOut)
def mark_myself_present(body: SelfAttendanceIn, member: ActiveMember, db: DB):
    """Self-service attendance: only ever "present", only for today (the server's clock, so it
    can't be backdated), only with at least one exercise, and only after checking in today."""
    today = gym_today()
    checked_in_today = db.scalar(
        select(Checkin.id).where(Checkin.user_id == member.user_id, Checkin.at >= local_midnight(today)).limit(1)
    )
    if checked_in_today is None:
        raise HTTPException(status_code=403, detail="Check in at the front desk first.")
    return _upsert(db, today, "member", member.user_id, member.user.name, "present", body.exercises)
