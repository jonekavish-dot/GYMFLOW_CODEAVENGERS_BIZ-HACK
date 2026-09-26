from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, UTCDateTime
from .timeutil import utcnow


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16))  # 'admin' | 'member'
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    member: Mapped["Member | None"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


class RefreshToken(Base):
    """One row per issued refresh token. Rotation revokes the old row; presenting a revoked
    one means the token was stolen or replayed, so the whole family is revoked."""

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    jti: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    family_id: Mapped[str] = mapped_column(String(64), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    duration_days: Mapped[int] = mapped_column(Integer)
    price: Mapped[int] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(String(255), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Member(Base):
    __tablename__ = "members"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    custom_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(32), default="")
    plan_id: Mapped[int | None] = mapped_column(ForeignKey("plans.id", ondelete="SET NULL"), nullable=True)
    plan_name: Mapped[str] = mapped_column(String(80))
    start_date: Mapped[datetime] = mapped_column(UTCDateTime)
    expiry_date: Mapped[datetime] = mapped_column(UTCDateTime)
    goals: Mapped[str] = mapped_column(Text, default="")
    exercise_category: Mapped[str] = mapped_column(String(1), default="A")
    notes: Mapped[str] = mapped_column(String(255), default="")
    method: Mapped[str] = mapped_column(String(24), default="Cash")
    paid: Mapped[int] = mapped_column(Integer, default=0)
    renewal_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user: Mapped[User] = relationship(back_populates="member")

    @property
    def name(self) -> str:
        return self.user.name

    @property
    def email(self) -> str:
        return self.user.email


class Payment(Base):
    """Append-only revenue ledger. Member fields are copied in so history survives deleting the member."""

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    member_name: Mapped[str] = mapped_column(String(120))
    custom_id: Mapped[str] = mapped_column(String(32), default="")
    amount: Mapped[int] = mapped_column(Integer)
    method: Mapped[str] = mapped_column(String(24), default="Cash")
    months: Mapped[int] = mapped_column(Integer, default=1)
    kind: Mapped[str] = mapped_column(String(16))  # 'join' | 'renewal'
    plan_name: Mapped[str] = mapped_column(String(80), default="")
    at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    expiry_after: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)


class GymClass(Base):
    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    trainer: Mapped[str] = mapped_column(String(120), default="")
    start_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
    duration_min: Mapped[int] = mapped_column(Integer, default=60)
    capacity: Mapped[int] = mapped_column(Integer)
    booked_count: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[list] = mapped_column(JSON, default=list)


class ClassBooking(Base):
    __tablename__ = "class_bookings"
    __table_args__ = (UniqueConstraint("class_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Slot(Base):
    __tablename__ = "slots"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    trainer: Mapped[str] = mapped_column(String(120), default="")
    start_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
    end_at: Mapped[datetime] = mapped_column(UTCDateTime)
    duration_min: Mapped[int] = mapped_column(Integer)
    capacity: Mapped[int] = mapped_column(Integer)
    booked_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(8), default="open")  # 'open' | 'closed'
    notes: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class SlotBooking(Base):
    __tablename__ = "slot_bookings"
    __table_args__ = (UniqueConstraint("slot_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    slot_id: Mapped[int] = mapped_column(ForeignKey("slots.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user: Mapped[User] = relationship()


class Trainer(Base):
    __tablename__ = "trainers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(120), default="")
    exp: Mapped[int] = mapped_column(Integer, default=0)
    phone: Mapped[str] = mapped_column(String(32), default="")
    title: Mapped[str] = mapped_column(String(120), default="")
    skills: Mapped[list] = mapped_column(JSON, default=list)
    is_owner: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Attendance(Base):
    """One row per person per day. person_id is a users.id for members and a trainers.id for
    trainers, so it is deliberately not a foreign key."""

    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("date", "kind", "person_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    kind: Mapped[str] = mapped_column(String(8))  # 'member' | 'trainer'
    person_id: Mapped[int] = mapped_column(Integer, index=True)
    name: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(8))  # 'present' | 'absent' | 'rest'
    exercises: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[str] = mapped_column(String(255), default="")
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class Checkin(Base):
    __tablename__ = "checkins"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    method: Mapped[str] = mapped_column(String(12), default="qr")  # 'qr' | 'otp' | 'manual'
    code_used: Mapped[str | None] = mapped_column(String(12), nullable=True)
    at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    checked_out_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True, index=True)

    user: Mapped[User] = relationship()


class CheckinSession(Base):
    """Singleton (id = 1): the one code the front desk is currently broadcasting."""

    __tablename__ = "checkin_session"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(12))
    validity_minutes: Mapped[int] = mapped_column(Integer)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    created_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[dict | list] = mapped_column(JSON)
