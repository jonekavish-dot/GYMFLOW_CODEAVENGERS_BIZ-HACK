from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from ..deps import DB, AdminUser, CurrentUser
from ..models import Setting
from ..schemas import ExerciseIn, ExercisesOut, GymProfile

router = APIRouter(prefix="/settings", tags=["settings"])

GYM_KEY = "gym"
EXERCISES_KEY = "custom_exercises"


def _get(db, key: str, default):
    row = db.scalar(select(Setting).where(Setting.key == key))
    return row.value if row else default


def _put(db, key: str, value) -> None:
    row = db.scalar(select(Setting).where(Setting.key == key))
    if row is None:
        db.add(Setting(key=key, value=value))
    else:
        row.value = value
    db.commit()


@router.get("/gym", response_model=GymProfile)
def get_gym(_: CurrentUser, db: DB):
    return GymProfile(**_get(db, GYM_KEY, {}))


@router.put("/gym", response_model=GymProfile)
def save_gym(body: GymProfile, _: AdminUser, db: DB):
    _put(db, GYM_KEY, body.model_dump())
    return body


@router.get("/exercises", response_model=ExercisesOut)
def get_exercises(_: CurrentUser, db: DB):
    return ExercisesOut(custom=_get(db, EXERCISES_KEY, []))


@router.post("/exercises", response_model=ExercisesOut, status_code=201)
def add_exercise(body: ExerciseIn, _: AdminUser, db: DB):
    custom = list(_get(db, EXERCISES_KEY, []))
    name = body.name.strip()
    if name in custom:
        raise HTTPException(status_code=409, detail=f'"{name}" already exists.')
    custom.append(name)
    _put(db, EXERCISES_KEY, custom)
    return ExercisesOut(custom=custom)


@router.delete("/exercises", response_model=ExercisesOut)
def remove_exercise(name: str, _: AdminUser, db: DB):
    # Name arrives as a query parameter: exercise names contain "&" and "/" ("Chest & Abs").
    custom = [c for c in _get(db, EXERCISES_KEY, []) if c != name]
    _put(db, EXERCISES_KEY, custom)
    return ExercisesOut(custom=custom)
