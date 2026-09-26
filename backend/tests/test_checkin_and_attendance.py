from datetime import datetime, timedelta, timezone

from app.models import CheckinSession
from app.timeutil import gym_today


def _code(client, admin, minutes=30) -> str:
    res = client.post("/api/checkin/session", headers=admin, json={"validity_minutes": minutes})
    assert res.status_code == 201
    return res.json()["code"]


def test_only_admin_can_generate_a_code_and_it_is_six_digits(client, admin, make_member):
    _, member = make_member()
    assert client.post("/api/checkin/session", headers=member, json={"validity_minutes": 30}).status_code == 403
    code = _code(client, admin)
    assert code.isdigit() and len(code) == 6


def test_validity_is_editable_in_minutes_up_to_a_week(client, admin):
    session = client.post("/api/checkin/session", headers=admin, json={"validity_minutes": 180}).json()
    left = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00")) - datetime.now(timezone.utc)
    assert timedelta(minutes=178) < left <= timedelta(minutes=180)
    assert client.post("/api/checkin/session", headers=admin, json={"validity_minutes": 0}).status_code == 422
    assert client.post("/api/checkin/session", headers=admin, json={"validity_minutes": 99999}).status_code == 422


def test_member_checks_in_with_the_current_code(client, admin, make_member):
    _, member = make_member()
    code = _code(client, admin)
    res = client.post("/api/checkin/self", headers=member, json={"code": code, "method": "otp"})
    assert res.status_code == 201 and res.json()["checked_out_at"] is None
    assert client.get("/api/checkin/me/open", headers=member).json()["id"] == res.json()["id"]
    assert len(client.get("/api/checkin/inside", headers=admin).json()) == 1


def test_wrong_code_and_replaced_code_are_rejected(client, admin, make_member):
    _, member = make_member()
    old = _code(client, admin)
    new = _code(client, admin)
    wrong = "000000" if new != "000000" else "111111"
    res = client.post("/api/checkin/self", headers=member, json={"code": wrong})
    assert res.status_code == 400 and res.json()["detail"] == "Wrong code."
    if old != new:  # generating a code replaces the previous one; the old digits stop working at once
        assert client.post("/api/checkin/self", headers=member, json={"code": old}).status_code == 400
    assert client.post("/api/checkin/self", headers=member, json={"code": new}).status_code == 201


def test_expired_code_is_rejected_even_if_it_matches(client, admin, make_member, db):
    _, member = make_member()
    code = _code(client, admin)
    session = db.get(CheckinSession, 1)
    session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()
    res = client.post("/api/checkin/self", headers=member, json={"code": code})
    assert res.status_code == 400 and "expired" in res.json()["detail"]


def test_revoking_a_code_stops_it_working(client, admin, make_member):
    _, member = make_member()
    code = _code(client, admin)
    assert client.delete("/api/checkin/session", headers=admin).status_code == 204
    assert client.get("/api/checkin/session", headers=admin).json() is None
    assert client.post("/api/checkin/self", headers=member, json={"code": code}).status_code == 400


def test_expired_membership_cannot_self_check_in(client, admin, make_member):
    _, old = make_member(days_ago=90)
    code = _code(client, admin)
    assert client.post("/api/checkin/self", headers=old, json={"code": code}).status_code == 403


def test_code_guessing_is_rate_limited(client, admin, make_member):
    _, member = make_member()
    code = _code(client, admin)
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(10):
        client.post("/api/checkin/self", headers=member, json={"code": wrong})
    # Even the right code is refused once the attempt budget is spent.
    assert client.post("/api/checkin/self", headers=member, json={"code": code}).status_code == 429


def test_double_check_in_is_refused_and_checkout_reopens_it(client, admin, make_member):
    _, member = make_member()
    code = _code(client, admin)
    first = client.post("/api/checkin/self", headers=member, json={"code": code}).json()
    assert client.post("/api/checkin/self", headers=member, json={"code": code}).status_code == 409
    out = client.post(f"/api/checkin/{first['id']}/checkout", headers=member)
    assert out.status_code == 200 and out.json()["checked_out_at"] is not None
    assert client.post("/api/checkin/self", headers=member, json={"code": code}).status_code == 201


def test_member_cannot_check_out_someone_else_but_admin_can(client, admin, make_member):
    _, a = make_member()
    _, b = make_member()
    code = _code(client, admin)
    ci = client.post("/api/checkin/self", headers=a, json={"code": code}).json()
    assert client.post(f"/api/checkin/{ci['id']}/checkout", headers=b).status_code == 404
    assert client.post(f"/api/checkin/{ci['id']}/checkout", headers=admin).status_code == 200


def test_admin_can_check_a_member_in_by_hand_without_a_code(client, admin, make_member):
    member, _ = make_member()
    res = client.post("/api/checkin/manual", headers=admin, json={"user_id": member["user_id"]})
    assert res.status_code == 201 and res.json()["method"] == "manual"


# ── attendance ──
def test_self_attendance_requires_checking_in_first(client, admin, make_member):
    _, member = make_member()
    res = client.put("/api/attendance/me/today", headers=member, json={"exercises": ["Chest & Abs"]})
    assert res.status_code == 403


def test_checking_in_then_picking_exercises_marks_present_and_shows_for_admin(client, admin, make_member):
    m, member = make_member()
    client.post("/api/checkin/self", headers=member, json={"code": _code(client, admin)})
    res = client.put("/api/attendance/me/today", headers=member, json={"exercises": ["Chest & Abs", "Thighs & Calf"]})
    assert res.status_code == 200
    assert res.json()["status"] == "present" and res.json()["date"] == str(gym_today())

    rows = client.get(f"/api/attendance?date={gym_today()}", headers=admin).json()
    assert [(r["person_id"], r["status"], r["exercises"]) for r in rows] == [
        (m["user_id"], "present", ["Chest & Abs", "Thighs & Calf"])]
    assert client.get("/api/attendance/me/today", headers=member).json()["exercises"] == ["Chest & Abs", "Thighs & Calf"]


def test_self_attendance_needs_at_least_one_exercise(client, admin, make_member):
    _, member = make_member()
    client.post("/api/checkin/self", headers=member, json={"code": _code(client, admin)})
    assert client.put("/api/attendance/me/today", headers=member, json={"exercises": []}).status_code == 422


def test_members_cannot_mark_absent_backdate_or_mark_others(client, admin, make_member):
    m, member = make_member()
    body = {"date": "2026-01-01", "kind": "member", "person_id": m["user_id"], "status": "present", "exercises": ["x"]}
    assert client.put("/api/attendance", headers=member, json=body).status_code == 403
    assert client.delete(f"/api/attendance?date=2026-01-01&kind=member&person_id={m['user_id']}",
                         headers=member).status_code == 403


def test_admin_marks_attendance_and_present_needs_an_exercise(client, admin, make_member):
    m, _ = make_member()
    base = {"date": str(gym_today()), "kind": "member", "person_id": m["user_id"]}
    assert client.put("/api/attendance", headers=admin, json={**base, "status": "present", "exercises": []}).status_code == 400
    assert client.put("/api/attendance", headers=admin, json={**base, "status": "absent"}).status_code == 200
    ok = client.put("/api/attendance", headers=admin, json={**base, "status": "present", "exercises": ["Lats & Abs"]})
    assert ok.status_code == 200 and ok.json()["status"] == "present"
    assert client.delete(f"/api/attendance?date={base['date']}&kind=member&person_id={m['user_id']}",
                         headers=admin).status_code == 204
    assert client.get(f"/api/attendance?date={base['date']}", headers=admin).json() == []


def test_attendance_history_is_scoped_to_the_member(client, admin, make_member):
    _, a = make_member()
    _, b = make_member()
    client.post("/api/checkin/self", headers=a, json={"code": _code(client, admin)})
    client.put("/api/attendance/me/today", headers=a, json={"exercises": ["Chest & Abs"]})
    assert len(client.get("/api/attendance/me", headers=a).json()) == 1
    assert client.get("/api/attendance/me", headers=b).json() == []
