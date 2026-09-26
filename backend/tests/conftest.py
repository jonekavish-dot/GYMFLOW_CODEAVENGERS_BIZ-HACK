import os
from datetime import date, datetime, timedelta, timezone

os.environ.setdefault("BCRYPT_ROUNDS", "4")  # before app import: fast hashing in tests only

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.db import Base, get_db, make_engine
from app.main import app
from app.ratelimit import checkin_limiter, login_limiter

ADMIN = {"name": "Owner", "email": "admin@gym.test", "password": "admin-pass-1"}


@pytest.fixture()
def factory():
    # SQLite in memory by default; set TEST_DATABASE_URL to run the same suite on Postgres.
    engine = make_engine(os.environ.get("TEST_DATABASE_URL", "sqlite://"))
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    engine.dispose()


@pytest.fixture()
def db(factory):
    with factory() as session:
        yield session


@pytest.fixture()
def client(factory):
    def override():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override
    login_limiter.reset_all()
    checkin_limiter.reset_all()
    yield TestClient(app)  # no `with`: skip lifespan so tests never touch the real DB
    app.dependency_overrides.clear()


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin(client) -> dict:
    res = client.post("/api/auth/bootstrap", json=ADMIN)
    assert res.status_code == 201, res.text
    return bearer(res.json()["access_token"])


@pytest.fixture()
def plan(client, admin) -> dict:
    res = client.post("/api/plans", headers=admin, json={"name": "Monthly", "duration_days": 30, "price": 1000})
    assert res.status_code == 201
    return res.json()


@pytest.fixture()
def make_member(client, admin, plan):
    """Registers a member and returns (member_json, auth_headers). `days_ago` back-dates the
    start so a 1-month membership is already expired when it's large enough."""
    counter = {"n": 0}

    def make(days_ago: int = 0, months: int = 1, **overrides):
        counter["n"] += 1
        n = counter["n"]
        body = {
            "name": f"Member {n}", "email": f"m{n}@gym.test", "password": "member-pass-1", "plan_id": plan["id"],
            "months": months, "start_date": str(date.today() - timedelta(days=days_ago)), "paid": 1000,
            **overrides,
        }
        res = client.post("/api/members", headers=admin, json=body)
        assert res.status_code == 201, res.text
        login = client.post("/api/auth/login", json={"email": body["email"], "password": body["password"]})
        assert login.status_code == 200, login.text
        return res.json(), bearer(login.json()["access_token"])

    return make


def in_hours(hours: float) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()
