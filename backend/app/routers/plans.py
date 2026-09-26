from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from ..deps import DB, AdminUser, CurrentUser
from ..models import Payment, Plan
from ..schemas import PaymentOut, PlanCreate, PlanOut, PlanUpdate

router = APIRouter(tags=["plans & payments"])


@router.get("/plans", response_model=list[PlanOut])
def list_plans(_: CurrentUser, db: DB):
    return db.scalars(select(Plan).order_by(Plan.duration_days, Plan.id)).all()


@router.post("/plans", response_model=PlanOut, status_code=201)
def create_plan(body: PlanCreate, _: AdminUser, db: DB):
    plan = Plan(name=body.name.strip(), duration_days=body.duration_days, price=body.price,
                description=body.description.strip())
    db.add(plan)
    db.commit()
    return plan


@router.patch("/plans/{plan_id}", response_model=PlanOut)
def update_plan(plan_id: int, body: PlanUpdate, _: AdminUser, db: DB):
    plan = db.get(Plan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found.")
    plan.active = body.active
    db.commit()
    return plan


@router.get("/payments", response_model=list[PaymentOut])
def list_payments(_: AdminUser, db: DB):
    return db.scalars(select(Payment).order_by(Payment.at.desc(), Payment.id.desc())).all()


@router.get("/payments/me", response_model=list[PaymentOut])
def my_payments(user: CurrentUser, db: DB):
    return db.scalars(
        select(Payment).where(Payment.user_id == user.id).order_by(Payment.at.desc(), Payment.id.desc())
    ).all()
