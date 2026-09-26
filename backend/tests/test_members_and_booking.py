from datetime import datetime, timedelta, timezone

from app.models import Payment
from tests.conftest import in_hours


# ── members & payments ──
def test_register_member_creates_login_and_opening_payment(client, admin, plan, make_member, db):
    member, headers = make_member()
    assert member["custom_id"] == "ASF001" and member["paid"] == 1000
    assert client.get("/api/members/me", headers=headers).json()["email"] == member["email"]
    assert [p["kind"] for p in client.get("/api/payments", headers=admin).json()] == ["join"]


def test_duplicate_email_is_rejected(client, admin, plan, make_member):
    member, _ = make_member()
    res = client.post("/api/members", headers=admin, json={
        "name": "Dup", "email": member["email"], "password": "member-pass-1", "plan_id": plan["id"],
        "start_date": "2026-01-01"})
    assert res.status_code == 409


def test_member_can_edit_goals_and_phone_only(client, make_member):
    member, headers = make_member()
    ok = client.patch("/api/members/me", headers=headers, json={"goals": "stamina", "phone": "999"})
    assert ok.json()["goals"] == "stamina"
    # Extra fields are ignored, never applied: a member can't extend their own expiry.
    client.patch("/api/members/me", headers=headers, json={"expiry_date": "2099-01-01T00:00:00Z", "paid": 0})
    after = client.get("/api/members/me", headers=headers).json()
    assert after["expiry_date"] == member["expiry_date"] and after["paid"] == 1000


def test_renewing_an_expired_membership_restarts_from_today(client, admin, plan, make_member):
    member, _ = make_member(days_ago=90, months=1)
    assert datetime.fromisoformat(member["expiry_date"].replace("Z", "+00:00")) < datetime.now(timezone.utc)
    res = client.post(f"/api/members/{member['user_id']}/renew", headers=admin,
                      json={"plan_id": plan["id"], "months": 1, "fee": 900, "method": "UPI"})
    assert res.status_code == 200
    renewed = res.json()
    new_expiry = datetime.fromisoformat(renewed["expiry_date"].replace("Z", "+00:00"))
    assert timedelta(days=27) < new_expiry - datetime.now(timezone.utc) < timedelta(days=32)
    assert renewed["paid"] == 1900 and renewed["renewal_count"] == 1


def test_renewing_an_active_membership_stacks_on_the_remaining_time(client, admin, plan, make_member):
    member, _ = make_member(days_ago=0, months=1)
    before = datetime.fromisoformat(member["expiry_date"].replace("Z", "+00:00"))
    renewed = client.post(f"/api/members/{member['user_id']}/renew", headers=admin,
                          json={"plan_id": plan["id"], "months": 3, "fee": 2700}).json()
    after = datetime.fromisoformat(renewed["expiry_date"].replace("Z", "+00:00"))
    assert timedelta(days=88) < after - before < timedelta(days=93)


def test_deleting_a_member_keeps_their_payment_history(client, admin, make_member, db):
    member, _ = make_member()
    assert client.delete(f"/api/members/{member['user_id']}", headers=admin).status_code == 204
    assert client.get(f"/api/members/{member['user_id']}", headers=admin).status_code == 404
    payments = db.query(Payment).all()
    assert len(payments) == 1 and payments[0].user_id is None and payments[0].member_name == member["name"]


def test_member_sees_only_their_own_payments(client, admin, make_member):
    _, a = make_member()
    _, b = make_member()
    assert len(client.get("/api/payments/me", headers=a).json()) == 1
    assert len(client.get("/api/payments", headers=admin).json()) == 2


# ── classes ──
def _class(client, admin, capacity=2, hours=5):
    res = client.post("/api/classes", headers=admin, json={
        "title": "HIIT", "trainer": "T", "start_at": in_hours(hours), "capacity": capacity})
    assert res.status_code == 201
    return res.json()


def test_class_capacity_is_enforced_and_seats_are_freed_on_cancel(client, admin, make_member):
    cls = _class(client, admin, capacity=1)
    _, a = make_member()
    _, b = make_member()
    assert client.post(f"/api/classes/{cls['id']}/book", headers=a).status_code == 201
    assert client.post(f"/api/classes/{cls['id']}/book", headers=b).status_code == 409  # full
    assert client.delete(f"/api/classes/{cls['id']}/book", headers=a).status_code == 204
    assert client.post(f"/api/classes/{cls['id']}/book", headers=b).status_code == 201
    listed = client.get("/api/classes", headers=b).json()[0]
    assert listed["booked_count"] == 1 and listed["booked"] is True


def test_cannot_book_the_same_class_twice(client, admin, make_member):
    cls = _class(client, admin)
    _, a = make_member()
    assert client.post(f"/api/classes/{cls['id']}/book", headers=a).status_code == 201
    assert client.post(f"/api/classes/{cls['id']}/book", headers=a).status_code == 409


def test_expired_member_cannot_book(client, admin, make_member):
    cls = _class(client, admin)
    _, old = make_member(days_ago=90)
    res = client.post(f"/api/classes/{cls['id']}/book", headers=old)
    assert res.status_code == 403 and "expired" in res.json()["detail"]


# ── gym slots ──
def _slot(client, admin, **kw):
    body = {"title": "Morning", "start_at": in_hours(5), "duration_min": 60, "capacity": 2, **kw}
    return client.post("/api/slots", headers=admin, json=body)


def test_trainer_cannot_be_double_booked_but_back_to_back_is_fine(client, admin):
    assert _slot(client, admin, trainer="Shankar").status_code == 201
    overlap = _slot(client, admin, trainer="Shankar", start_at=in_hours(5.5))
    assert overlap.status_code == 409 and "Time Security Conflict" in overlap.json()["detail"]
    assert _slot(client, admin, trainer="Shankar", start_at=in_hours(6)).status_code == 201  # starts as the other ends
    assert _slot(client, admin, trainer="Divya", start_at=in_hours(5.5)).status_code == 201  # different trainer


def test_slot_capacity_closed_and_overlap_rules(client, admin, make_member):
    slot = _slot(client, admin, capacity=1).json()
    closed = _slot(client, admin, start_at=in_hours(30), status="closed").json()
    _, a = make_member()
    _, b = make_member()
    assert client.post(f"/api/slots/{slot['id']}/book", headers=a).status_code == 201
    assert client.post(f"/api/slots/{slot['id']}/book", headers=b).status_code == 409  # full
    assert client.post(f"/api/slots/{closed['id']}/book", headers=b).status_code == 409  # closed
    assert client.post(f"/api/slots/{slot['id']}/book", headers=a).status_code == 409  # already booked

    overlapping = _slot(client, admin, start_at=in_hours(5.25), capacity=5).json()
    assert client.post(f"/api/slots/{overlapping['id']}/book", headers=a).status_code == 409  # a is busy then


def test_members_cannot_cancel_slots_but_admin_can_free_a_seat(client, admin, make_member):
    slot = _slot(client, admin, capacity=1).json()
    member, a = make_member()
    _, b = make_member()
    client.post(f"/api/slots/{slot['id']}/book", headers=a)

    assert client.delete(f"/api/slots/{slot['id']}/book", headers=a).status_code in (404, 405)
    assert client.delete(f"/api/slots/{slot['id']}/bookings/{member['user_id']}", headers=a).status_code == 403

    roster = client.get(f"/api/slots/{slot['id']}/roster", headers=admin).json()
    assert [r["member_name"] for r in roster] == [member["name"]]
    assert client.delete(f"/api/slots/{slot['id']}/bookings/{member['user_id']}", headers=admin).status_code == 204
    assert client.post(f"/api/slots/{slot['id']}/book", headers=b).status_code == 201  # seat is free again


def test_expired_member_cannot_book_a_slot(client, admin, make_member):
    slot = _slot(client, admin).json()
    _, old = make_member(days_ago=90)
    assert client.post(f"/api/slots/{slot['id']}/book", headers=old).status_code == 403
