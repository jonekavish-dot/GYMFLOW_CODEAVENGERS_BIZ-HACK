"""Populate a database with demo data:   python -m app.seed_demo --reset

Logins:  admin@gymflow.test / admin123   ·   member@gymflow.test / member123
"""
import argparse
import secrets
from datetime import timedelta

from sqlalchemy import select

from .db import Base, SessionLocal, engine
from .models import (
    Attendance, Checkin, CheckinSession, ClassBooking, GymClass, Member, Payment, Plan, Setting, Slot,
    SlotBooking, Trainer, User,
)
from .security import hash_password
from .timeutil import add_months, end_of_local_day, gym_today, local_midnight, utcnow

DAY = timedelta(days=1)


def seed() -> None:
    now = utcnow()
    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)):
            print("Database already has users — run with --reset to start over.")
            return

        admin = User(email="admin@gymflow.test", name="Test Admin", role="admin", password_hash=hash_password("admin123"))
        priya = User(email="member@gymflow.test", name="Priya Raman", role="member", password_hash=hash_password("member123"))
        karthik = User(email="karthik@gymflow.test", name="Karthik S", role="member", password_hash=hash_password("member123"))
        meena = User(email="meena@gymflow.test", name="Meena Krishnan", role="member", password_hash=hash_password("member123"))
        db.add_all([admin, priya, karthik, meena])
        db.flush()

        monthly = Plan(name="Monthly Strength", duration_days=30, price=1000, description="Weights + coaching")
        quarterly = Plan(name="Quarterly Cardio", duration_days=90, price=2700, description="Cardio floor + classes")
        yearly = Plan(name="Yearly Elite", duration_days=365, price=9600, description="Everything, all year")
        db.add_all([monthly, quarterly, yearly])
        db.flush()

        def member(user, custom_id, plan, category, started_days_ago, days_left, paid, renewals, phone, goals, method):
            db.add(Member(
                user_id=user.id, custom_id=custom_id, phone=phone, plan_id=plan.id, plan_name=plan.name,
                start_date=local_midnight((now - started_days_ago * DAY).astimezone().date()),
                expiry_date=end_of_local_day(now + days_left * DAY), goals=goals, exercise_category=category,
                method=method, paid=paid, renewal_count=renewals,
            ))

        member(priya, "ASF001", monthly, "B", 10, 20, 3000, 2, "98400 22222", "build stamina, lose 4kg", "UPI")
        member(karthik, "ASF002", monthly, "F", 28, 2, 1000, 0, "98400 33333", "bulk up", "Cash")
        member(meena, "ASF003", quarterly, "A", 100, -8, 2700, 0, "98400 44444", "", "Card")

        def pay(user, name, cid, plan_name, amount, method, months, kind, days_ago):
            db.add(Payment(user_id=user.id, member_name=name, custom_id=cid, amount=amount, method=method,
                           months=months, kind=kind, plan_name=plan_name, at=now - days_ago * DAY))

        pay(priya, "Priya Raman", "ASF001", "Monthly Strength", 1000, "UPI", 1, "join", 100)
        pay(priya, "Priya Raman", "ASF001", "Monthly Strength", 1000, "UPI", 1, "renewal", 68)
        pay(priya, "Priya Raman", "ASF001", "Monthly Strength", 1000, "Cash", 1, "renewal", 36)
        pay(karthik, "Karthik S", "ASF002", "Monthly Strength", 1000, "Cash", 1, "join", 28)
        pay(meena, "Meena Krishnan", "ASF003", "Quarterly Cardio", 2700, "Card", 3, "join", 100)
        pay(priya, "Priya Raman", "ASF001", "Monthly Strength", 1000, "UPI", 1, "renewal", 5)

        shankar = Trainer(name="Shankar", role="Strength & Conditioning", exp=12, phone="98400 11111",
                          title="Mr. Tamil Nadu", skills=["Powerlifting", "Nutrition"], is_owner=True)
        divya = Trainer(name="Divya", role="Cardio & Yoga", exp=4, phone="98400 55555", skills=["Yoga", "HIIT"])
        db.add_all([shankar, divya])

        hiit = GymClass(title="HIIT Blast", trainer="Divya", start_at=now + 2 * DAY, duration_min=45, capacity=12,
                        booked_count=1, tags=["cardio"])
        strength = GymClass(title="Morning Strength", trainer="Shankar", start_at=now + 1 * DAY, duration_min=60,
                            capacity=2, booked_count=2, tags=["strength"])
        db.add_all([hiit, strength])

        morning = Slot(title="Morning Workout (Floor A)", trainer="Shankar", start_at=now + timedelta(hours=18),
                       end_at=now + timedelta(hours=19), duration_min=60, capacity=15, booked_count=0,
                       notes="Bring personal gym towel & water")
        evening = Slot(title="Evening Cardio & Yoga", trainer="Divya", start_at=now + timedelta(hours=30),
                       end_at=now + timedelta(hours=31, minutes=30), duration_min=90, capacity=12, booked_count=2)
        db.add_all([morning, evening])
        db.flush()
        db.add_all([
            ClassBooking(class_id=hiit.id, user_id=priya.id),
            ClassBooking(class_id=strength.id, user_id=priya.id),
            ClassBooking(class_id=strength.id, user_id=karthik.id),
            SlotBooking(slot_id=evening.id, user_id=priya.id),
            SlotBooking(slot_id=evening.id, user_id=karthik.id),
        ])

        # Six days of history for Priya (one absence), plus Karthik and both trainers today.
        today = gym_today()
        for i in range(6):
            db.add(Attendance(
                date=today - i * DAY, kind="member", person_id=priya.id, name="Priya Raman",
                status="absent" if i == 3 else "present",
                exercises=[] if i == 3 else ["Chest & Abs", "Thighs & Calf"],
            ))
        db.add(Attendance(date=today, kind="member", person_id=karthik.id, name="Karthik S", status="present",
                          exercises=["Chest & Triceps & Abs"]))
        db.add(Attendance(date=today, kind="trainer", person_id=1, name="Shankar", status="present", exercises=[]))

        db.add(Setting(key="gym", value={"name": "A.S. Fitness", "owner": "Shankar", "phone": "98400 11111",
                                          "email": "hello@asfitness.example", "address": "Erode, Tamil Nadu"}))
        db.add(Setting(key="custom_exercises", value=["Deadlift", "Farmer Walk"]))

        db.add(CheckinSession(id=1, code=f"{secrets.randbelow(900_000) + 100_000}", validity_minutes=30,
                              expires_at=now + timedelta(minutes=30), created_by=admin.id))
        db.add(Checkin(user_id=priya.id, method="qr", at=now - timedelta(minutes=12)))
        db.commit()
        print("Seeded. admin@gymflow.test / admin123  ·  member@gymflow.test / member123")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="drop and recreate every table first")
    args = parser.parse_args()
    if args.reset:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    seed()
