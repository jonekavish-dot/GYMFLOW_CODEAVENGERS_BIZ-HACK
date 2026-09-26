from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from ..deps import DB, AdminUser, CurrentUser
from ..models import Trainer
from ..schemas import TrainerIn, TrainerOut

router = APIRouter(prefix="/trainers", tags=["trainers"])


def _apply(trainer: Trainer, body: TrainerIn) -> None:
    trainer.name = body.name.strip()
    trainer.role = body.role.strip()
    trainer.exp = body.exp
    trainer.phone = body.phone.strip()
    trainer.title = body.title.strip()
    trainer.skills = [s.strip() for s in body.skills if s.strip()]
    trainer.is_owner = body.is_owner


@router.get("", response_model=list[TrainerOut])
def list_trainers(_: CurrentUser, db: DB):
    return db.scalars(select(Trainer).where(Trainer.active.is_(True)).order_by(Trainer.name)).all()


@router.post("", response_model=TrainerOut, status_code=201)
def create_trainer(body: TrainerIn, _: AdminUser, db: DB):
    trainer = Trainer()
    _apply(trainer, body)
    db.add(trainer)
    db.commit()
    return trainer


@router.put("/{trainer_id}", response_model=TrainerOut)
def update_trainer(trainer_id: int, body: TrainerIn, _: AdminUser, db: DB):
    trainer = db.get(Trainer, trainer_id)
    if trainer is None:
        raise HTTPException(status_code=404, detail="Trainer not found.")
    _apply(trainer, body)
    db.commit()
    return trainer


@router.delete("/{trainer_id}", status_code=204)
def delete_trainer(trainer_id: int, _: AdminUser, db: DB):
    trainer = db.get(Trainer, trainer_id)
    if trainer is None:
        raise HTTPException(status_code=404, detail="Trainer not found.")
    db.delete(trainer)
    db.commit()
