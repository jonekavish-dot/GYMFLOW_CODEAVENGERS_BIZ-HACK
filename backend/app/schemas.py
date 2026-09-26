import re
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _email(value: str) -> str:
    value = value.strip().lower()
    if not _EMAIL_RE.match(value) or len(value) > 255:
        raise ValueError("enter a valid email address")
    return value


Email = Annotated[str, AfterValidator(_email)]
Password = Annotated[str, Field(min_length=8, max_length=128)]
Method = Literal["Cash", "UPI", "Card", "Bank Transfer"]
Category = Literal["A", "B", "C", "D", "E", "F"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── auth ──
class UserOut(ORM):
    id: int
    email: str
    name: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class LoginIn(BaseModel):
    email: Email
    password: str = Field(min_length=1, max_length=128)


class BootstrapIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: Email
    password: Password


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: Password


class ResetPasswordIn(BaseModel):
    new_password: Password


class StatusOut(BaseModel):
    ok: bool = True
    bootstrapped: bool


# ── plans / members / payments ──
class PlanOut(ORM):
    id: int
    name: str
    duration_days: int
    price: int
    description: str
    active: bool


class PlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    duration_days: int = Field(ge=1, le=3650)
    price: int = Field(ge=0, le=10_000_000)
    description: str = Field("", max_length=255)


class PlanUpdate(BaseModel):
    active: bool


class MemberOut(ORM):
    user_id: int
    name: str
    email: str
    custom_id: str
    phone: str
    plan_id: int | None
    plan_name: str
    start_date: datetime
    expiry_date: datetime
    goals: str
    exercise_category: str
    notes: str
    method: str
    paid: int
    renewal_count: int


class MemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: Email
    phone: str = Field("", max_length=32)
    password: Password
    plan_id: int
    months: int | None = Field(None, ge=1, le=36)
    start_date: date
    goals: str = Field("", max_length=1000)
    exercise_category: Category = "A"
    paid: int = Field(0, ge=0, le=10_000_000)
    method: Method = "Cash"
    notes: str = Field("", max_length=255)
    custom_id: str = Field("", max_length=32)


class MemberUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    phone: str | None = Field(None, max_length=32)
    exercise_category: Category | None = None
    notes: str | None = Field(None, max_length=255)


class MemberSelfUpdate(BaseModel):
    goals: str | None = Field(None, max_length=1000)
    phone: str | None = Field(None, max_length=32)


class RenewIn(BaseModel):
    plan_id: int
    months: int = Field(ge=1, le=36)
    fee: int = Field(ge=0, le=10_000_000)
    method: Method = "Cash"


class PaymentOut(ORM):
    id: int
    user_id: int | None
    member_name: str
    custom_id: str
    amount: int
    method: str
    months: int
    kind: str
    plan_name: str
    at: datetime
    expiry_after: datetime | None


# ── classes / slots ──
class ClassOut(ORM):
    id: int
    title: str
    trainer: str
    start_at: datetime
    duration_min: int
    capacity: int
    booked_count: int
    tags: list[str]
    booked: bool = False


class ClassCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    trainer: str = Field("", max_length=120)
    start_at: datetime
    duration_min: int = Field(60, ge=10, le=600)
    capacity: int = Field(ge=1, le=1000)
    tags: list[str] = Field(default_factory=list, max_length=10)


class SlotOut(ORM):
    id: int
    title: str
    trainer: str
    start_at: datetime
    end_at: datetime
    duration_min: int
    capacity: int
    booked_count: int
    status: str
    notes: str
    booked: bool = False


class SlotCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    trainer: str = Field("", max_length=120)
    start_at: datetime
    duration_min: int = Field(60, ge=15, le=720)
    capacity: int = Field(ge=1, le=1000)
    status: Literal["open", "closed"] = "open"
    notes: str = Field("", max_length=255)


class SlotStatusIn(BaseModel):
    status: Literal["open", "closed"]


class RosterOut(BaseModel):
    user_id: int
    member_name: str
    custom_id: str
    booked_at: datetime


# ── trainers ──
class TrainerOut(ORM):
    id: int
    name: str
    role: str
    exp: int
    phone: str
    title: str
    skills: list[str]
    is_owner: bool
    active: bool


class TrainerIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    role: str = Field("", max_length=120)
    exp: int = Field(0, ge=0, le=80)
    phone: str = Field("", max_length=32)
    title: str = Field("", max_length=120)
    skills: list[str] = Field(default_factory=list, max_length=20)
    is_owner: bool = False


# ── attendance ──
class AttendanceOut(ORM):
    id: int
    date: date
    kind: str
    person_id: int
    name: str
    status: str
    exercises: list[str]
    notes: str


class AttendanceIn(BaseModel):
    date: date
    kind: Literal["member", "trainer"]
    person_id: int
    status: Literal["present", "absent", "rest"]
    exercises: list[str] = Field(default_factory=list, max_length=60)
    notes: str = Field("", max_length=255)


class SelfAttendanceIn(BaseModel):
    exercises: list[str] = Field(min_length=1, max_length=60)


# ── check-in ──
class CheckinSessionOut(ORM):
    code: str
    validity_minutes: int
    expires_at: datetime
    created_at: datetime


class CheckinSessionIn(BaseModel):
    validity_minutes: int = Field(ge=1, le=7 * 24 * 60)


class SelfCheckinIn(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")
    method: Literal["qr", "otp"] = "qr"


class ManualCheckinIn(BaseModel):
    user_id: int


class CheckinOut(ORM):
    id: int
    user_id: int
    method: str
    at: datetime
    checked_out_at: datetime | None


class InsideOut(BaseModel):
    id: int
    user_id: int
    name: str
    custom_id: str
    method: str
    at: datetime


# ── settings ──
class GymProfile(BaseModel):
    name: str = Field("", max_length=120)
    owner: str = Field("", max_length=120)
    phone: str = Field("", max_length=32)
    email: str = Field("", max_length=255)
    address: str = Field("", max_length=500)


class ExerciseIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ExercisesOut(BaseModel):
    custom: list[str]
