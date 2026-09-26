import time
from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings
from app.models import RefreshToken
from tests.conftest import ADMIN, bearer


def test_bootstrap_only_works_once(client):
    assert client.get("/api/auth/status").json() == {"ok": True, "bootstrapped": False}
    assert client.post("/api/auth/bootstrap", json=ADMIN).status_code == 201
    assert client.get("/api/auth/status").json()["bootstrapped"] is True
    second = client.post("/api/auth/bootstrap", json={**ADMIN, "email": "other@gym.test"})
    assert second.status_code == 409


def test_login_returns_token_and_sets_httponly_refresh_cookie(client, admin):
    res = client.post("/api/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["role"] == "admin" and body["token_type"] == "bearer"
    cookie = res.headers["set-cookie"].lower()
    assert "gf_refresh=" in cookie and "httponly" in cookie and "samesite=lax" in cookie
    assert "refresh_token" not in body  # the refresh token never appears in the JSON body


def test_wrong_password_and_unknown_user_look_identical(client, admin):
    wrong = client.post("/api/auth/login", json={"email": ADMIN["email"], "password": "nope-nope-1"})
    unknown = client.post("/api/auth/login", json={"email": "ghost@gym.test", "password": "nope-nope-1"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_login_is_rate_limited_after_repeated_failures(client, admin):
    for _ in range(8):
        client.post("/api/auth/login", json={"email": ADMIN["email"], "password": "bad-password-1"})
    blocked = client.post("/api/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})
    assert blocked.status_code == 429


def test_protected_routes_need_a_valid_access_token(client, admin):
    assert client.get("/api/members").status_code == 401
    assert client.get("/api/members", headers=bearer("garbage")).status_code == 401


def test_expired_access_token_is_rejected(client, admin):
    stale = jwt.encode(
        {"sub": "1", "role": "admin", "type": "access", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.jwt_secret, algorithm=settings.jwt_algorithm,
    )
    res = client.get("/api/members", headers=bearer(stale))
    assert res.status_code == 401 and res.json()["detail"] == "Token expired"


def test_refresh_token_cannot_be_used_as_an_access_token(client, admin):
    client.post("/api/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})
    refresh = client.cookies.get("gf_refresh")
    assert client.get("/api/auth/me", headers=bearer(refresh)).status_code == 401


def test_refresh_rotates_the_token_and_issues_a_new_access_token(client, admin):
    client.post("/api/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})
    old = client.cookies.get("gf_refresh")
    res = client.post("/api/auth/refresh")
    assert res.status_code == 200
    assert client.get("/api/auth/me", headers=bearer(res.json()["access_token"])).status_code == 200
    assert client.cookies.get("gf_refresh") != old


def test_replaying_a_rotated_refresh_token_revokes_the_whole_family(client, admin, db):
    client.post("/api/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})
    stolen = client.cookies.get("gf_refresh")
    assert client.post("/api/auth/refresh").status_code == 200  # legitimate rotation
    legit_current = client.cookies.get("gf_refresh")

    # Age the rotation past the grace window so a replay looks like theft, not a tab race.
    for row in db.query(RefreshToken).filter(RefreshToken.revoked_at.isnot(None)):
        row.revoked_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    db.commit()

    client.cookies.clear()
    client.cookies.set("gf_refresh", stolen, path="/api/auth")
    assert client.post("/api/auth/refresh").status_code == 401

    client.cookies.clear()
    client.cookies.set("gf_refresh", legit_current, path="/api/auth")
    assert client.post("/api/auth/refresh").status_code == 401  # the thief's replay killed it too


def test_logout_revokes_the_refresh_token(client, admin):
    client.post("/api/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})
    token = client.cookies.get("gf_refresh")
    assert client.post("/api/auth/logout").status_code == 204
    client.cookies.set("gf_refresh", token, path="/api/auth")
    assert client.post("/api/auth/refresh").status_code == 401


def test_change_password_signs_out_other_sessions_but_keeps_this_one(client, admin):
    login = client.post("/api/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})
    headers = bearer(login.json()["access_token"])
    other_device = client.cookies.get("gf_refresh")

    bad = client.post("/api/auth/change-password", headers=headers,
                      json={"current_password": "wrong-pass-1", "new_password": "brand-new-pass-1"})
    assert bad.status_code == 400
    ok = client.post("/api/auth/change-password", headers=headers,
                     json={"current_password": ADMIN["password"], "new_password": "brand-new-pass-1"})
    assert ok.status_code == 200

    # This device got a fresh session and can keep refreshing...
    assert client.post("/api/auth/refresh").status_code == 200
    # ...but a session that existed before the change is dead.
    client.cookies.clear()
    client.cookies.set("gf_refresh", other_device, path="/api/auth")
    assert client.post("/api/auth/refresh").status_code == 401
    assert client.post("/api/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]}).status_code == 401
    assert client.post("/api/auth/login", json={"email": ADMIN["email"], "password": "brand-new-pass-1"}).status_code == 200


def test_members_cannot_reach_admin_routes(client, make_member):
    _, member = make_member()
    for method, path in [("get", "/api/members"), ("get", "/api/payments"), ("post", "/api/plans"),
                         ("get", "/api/checkin/inside"), ("get", "/api/attendance?date=2026-01-01")]:
        assert getattr(client, method)(path, headers=member).status_code == 403, path


def test_admin_cannot_use_member_only_routes(client, admin):
    assert client.get("/api/members/me", headers=admin).status_code == 403
    assert client.post("/api/checkin/self", headers=admin, json={"code": "123456"}).status_code == 403


def test_deactivated_user_is_locked_out_immediately(client, make_member, db):
    member, headers = make_member()
    from app.models import User
    db.get(User, member["user_id"]).is_active = False
    db.commit()
    assert client.get("/api/members/me", headers=headers).status_code == 401
