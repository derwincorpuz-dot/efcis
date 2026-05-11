"""EFCIS LMS - User Management (Admin) and Attendance backend tests.

Covers:
- /api/users CRUD (admin only)
- /api/attendance/check-in, check-out, me, today
- /api/attendance (admin), PUT /api/attendance/{id}, /api/attendance/payroll
- Auth + role enforcement

Test users prefixed with `TESTU_` for cleanup identification.
"""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("admin.system@gmail.com", "Systemdev0118"),
    "field_collector": ("fc.lucena@gmail.com", "FC@lucena12345"),
    "branch_assistant": ("assitant.lucena@gmail.com", "Assistant@lucena12345"),
}


def _login(role):
    email, pw = CREDS[role]
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, f"{role} login failed: {r.text}"
    body = r.json()
    return body["token"], body["user"]


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def _login_creds(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    return r


# ---------- Module-scoped fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    tok, _ = _login("admin")
    return tok


@pytest.fixture(scope="module")
def admin_user(admin_token):
    r = requests.get(f"{API}/auth/me", headers=_h(admin_token), timeout=20)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def fc_token():
    tok, _ = _login("field_collector")
    return tok


@pytest.fixture(scope="module")
def ba_token():
    tok, _ = _login("branch_assistant")
    return tok


@pytest.fixture(scope="module")
def created_users_cleanup(admin_token):
    """Track created TESTU_ users and clean up after module."""
    created_ids = []
    yield created_ids
    # teardown
    for uid in created_ids:
        try:
            requests.delete(f"{API}/users/{uid}", headers=_h(admin_token), timeout=10)
        except Exception:
            pass


# ========== USER MANAGEMENT ==========
class TestUsersAuth:
    def test_users_requires_auth(self):
        r = requests.get(f"{API}/users", timeout=10)
        assert r.status_code == 401

    def test_users_non_admin_forbidden(self, fc_token):
        r = requests.get(f"{API}/users", headers=_h(fc_token), timeout=10)
        assert r.status_code == 403

    def test_create_user_non_admin_forbidden(self, fc_token):
        r = requests.post(
            f"{API}/users",
            headers=_h(fc_token),
            json={"email": "TESTU_x@example.com", "password": "x", "name": "x", "role": "field_collector"},
            timeout=10,
        )
        assert r.status_code == 403


class TestUsersList:
    def test_list_users_excludes_password_hash(self, admin_token):
        r = requests.get(f"{API}/users", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 7  # 7 seeded users
        for u in items:
            assert "password_hash" not in u
            assert "_id" not in u
            assert "id" in u
            assert "email" in u
            assert "role" in u
            # avatar_data_url should be present (may be None)
            # seeded users won't have it set, but key may be absent for them. Just allow.


class TestUsersCRUD:
    def test_create_user_success(self, admin_token, created_users_cleanup):
        unique = uuid.uuid4().hex[:8]
        email = f"testu_{unique}@example.com"
        payload = {
            "email": email,
            "password": "TestPass@123",
            "name": "TESTU User One",
            "role": "field_collector",
            "avatar_data_url": "data:image/png;base64,AAA",
        }
        r = requests.post(f"{API}/users", headers=_h(admin_token), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email"] == email
        assert body["name"] == "TESTU User One"
        assert body["role"] == "field_collector"
        assert body["avatar_data_url"] == "data:image/png;base64,AAA"
        assert "id" in body
        assert "password_hash" not in body
        created_users_cleanup.append(body["id"])

        # Verify persistence via GET /users
        r2 = requests.get(f"{API}/users", headers=_h(admin_token), timeout=10)
        assert r2.status_code == 200
        ids = [u["id"] for u in r2.json()]
        assert body["id"] in ids

    def test_create_user_duplicate_email(self, admin_token, created_users_cleanup):
        unique = uuid.uuid4().hex[:8]
        email = f"TESTU_dup_{unique}@example.com"
        payload = {"email": email, "password": "p@ssw0rd", "name": "Dup", "role": "verifier"}
        r1 = requests.post(f"{API}/users", headers=_h(admin_token), json=payload, timeout=10)
        assert r1.status_code == 200
        created_users_cleanup.append(r1.json()["id"])
        r2 = requests.post(f"{API}/users", headers=_h(admin_token), json=payload, timeout=10)
        assert r2.status_code == 409

    def test_create_user_missing_fields(self, admin_token):
        r = requests.post(f"{API}/users", headers=_h(admin_token), json={"email": "TESTU_bad@x.com"}, timeout=10)
        assert r.status_code == 400

    def test_update_user_fields(self, admin_token, created_users_cleanup):
        unique = uuid.uuid4().hex[:8]
        email = f"testu_upd_{unique}@example.com"
        r = requests.post(f"{API}/users", headers=_h(admin_token), json={
            "email": email, "password": "OldPass@123", "name": "Old Name", "role": "field_collector"
        }, timeout=10)
        assert r.status_code == 200
        uid = r.json()["id"]
        created_users_cleanup.append(uid)

        # Update name, role, avatar, password
        new_email = f"testu_upd2_{unique}@example.com"
        r2 = requests.put(f"{API}/users/{uid}", headers=_h(admin_token), json={
            "name": "New Name",
            "role": "verifier",
            "avatar_data_url": "data:image/png;base64,BBB",
            "password": "NewPass@123",
            "email": new_email,
        }, timeout=10)
        assert r2.status_code == 200, r2.text
        upd = r2.json()
        assert upd["name"] == "New Name"
        assert upd["role"] == "verifier"
        assert upd["email"] == new_email
        assert upd["avatar_data_url"] == "data:image/png;base64,BBB"
        assert "password_hash" not in upd

        # Verify new password works
        login_r = _login_creds(new_email, "NewPass@123")
        assert login_r.status_code == 200, login_r.text
        # old password should not work
        old_r = _login_creds(new_email, "OldPass@123")
        assert old_r.status_code == 401

    def test_update_user_email_conflict(self, admin_token, created_users_cleanup):
        unique = uuid.uuid4().hex[:8]
        e1 = f"TESTU_a_{unique}@example.com"
        e2 = f"TESTU_b_{unique}@example.com"
        r1 = requests.post(f"{API}/users", headers=_h(admin_token), json={
            "email": e1, "password": "p@1", "name": "A", "role": "verifier"}, timeout=10)
        r2 = requests.post(f"{API}/users", headers=_h(admin_token), json={
            "email": e2, "password": "p@2", "name": "B", "role": "verifier"}, timeout=10)
        assert r1.status_code == 200 and r2.status_code == 200
        u1, u2 = r1.json()["id"], r2.json()["id"]
        created_users_cleanup.extend([u1, u2])

        # Try to update u2's email to u1's email -> 409
        rconf = requests.put(f"{API}/users/{u2}", headers=_h(admin_token), json={"email": e1}, timeout=10)
        assert rconf.status_code == 409

    def test_delete_user_self_blocked(self, admin_token, admin_user):
        r = requests.delete(f"{API}/users/{admin_user['id']}", headers=_h(admin_token), timeout=10)
        assert r.status_code == 400

    def test_delete_other_user(self, admin_token):
        unique = uuid.uuid4().hex[:8]
        r = requests.post(f"{API}/users", headers=_h(admin_token), json={
            "email": f"TESTU_del_{unique}@example.com",
            "password": "p@ssw0rd",
            "name": "ToDelete",
            "role": "field_collector",
        }, timeout=10)
        assert r.status_code == 200
        uid = r.json()["id"]

        rdel = requests.delete(f"{API}/users/{uid}", headers=_h(admin_token), timeout=10)
        assert rdel.status_code == 200
        assert rdel.json().get("ok") is True

        # Verify removal in /users list
        lst = requests.get(f"{API}/users", headers=_h(admin_token), timeout=10).json()
        ids = [u["id"] for u in lst]
        assert uid not in ids

    def test_delete_user_not_found(self, admin_token):
        r = requests.delete(f"{API}/users/nonexistent-id-xyz", headers=_h(admin_token), timeout=10)
        assert r.status_code == 404

    def test_new_user_login_and_check_in(self, admin_token, created_users_cleanup):
        """End-to-end: create user -> they login -> /auth/me returns correct role -> check-in works."""
        unique = uuid.uuid4().hex[:8]
        email = f"testu_ci_{unique}@example.com"
        password = "CheckIn@123"
        r = requests.post(f"{API}/users", headers=_h(admin_token), json={
            "email": email, "password": password, "name": "TESTU Checkin",
            "role": "branch_manager",
        }, timeout=10)
        assert r.status_code == 200
        uid = r.json()["id"]
        created_users_cleanup.append(uid)

        # Login
        login_r = _login_creds(email, password)
        assert login_r.status_code == 200
        token = login_r.json()["token"]

        # /auth/me returns correct role
        me_r = requests.get(f"{API}/auth/me", headers=_h(token), timeout=10)
        assert me_r.status_code == 200
        me = me_r.json()
        assert me["role"] == "branch_manager"
        assert me["email"] == email

        # Check-in
        ci_r = requests.post(f"{API}/attendance/check-in", headers=_h(token), json={"location": "Office"}, timeout=10)
        assert ci_r.status_code == 200, ci_r.text
        rec = ci_r.json()
        assert rec["user_id"] == uid
        assert rec["status"] == "present"
        assert rec.get("check_in")


# ========== ATTENDANCE ==========
@pytest.fixture(scope="module")
def att_user_token(admin_token, created_users_cleanup):
    """Create a fresh user dedicated for attendance tests (clean slate today)."""
    unique = uuid.uuid4().hex[:8]
    email = f"TESTU_att_{unique}@example.com"
    password = "AttUser@123"
    r = requests.post(f"{API}/users", headers=_h(admin_token), json={
        "email": email, "password": password, "name": "TESTU Att User",
        "role": "field_collector",
    }, timeout=10)
    assert r.status_code == 200
    uid = r.json()["id"]
    created_users_cleanup.append(uid)
    login_r = _login_creds(email, password)
    assert login_r.status_code == 200
    return login_r.json()["token"], uid, email


class TestAttendanceAuth:
    def test_check_in_requires_auth(self):
        r = requests.post(f"{API}/attendance/check-in", json={}, timeout=10)
        assert r.status_code == 401

    def test_check_out_requires_auth(self):
        r = requests.post(f"{API}/attendance/check-out", json={}, timeout=10)
        assert r.status_code == 401

    def test_attendance_today_requires_auth(self):
        r = requests.get(f"{API}/attendance/today", timeout=10)
        assert r.status_code == 401

    def test_attendance_me_requires_auth(self):
        r = requests.get(f"{API}/attendance/me", timeout=10)
        assert r.status_code == 401

    def test_attendance_admin_requires_auth(self):
        r = requests.get(f"{API}/attendance", timeout=10)
        assert r.status_code == 401

    def test_attendance_admin_non_admin_forbidden(self, fc_token):
        r = requests.get(f"{API}/attendance", headers=_h(fc_token), timeout=10)
        assert r.status_code == 403


class TestAttendanceFlow:
    def test_today_empty_initially(self, att_user_token):
        token, _uid, _e = att_user_token
        r = requests.get(f"{API}/attendance/today", headers=_h(token), timeout=10)
        assert r.status_code == 200
        # Should be empty dict before check-in
        assert r.json() == {}

    def test_check_in_creates_record(self, att_user_token):
        token, uid, _e = att_user_token
        r = requests.post(f"{API}/attendance/check-in", headers=_h(token), json={"location": "HQ"}, timeout=10)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["user_id"] == uid
        assert rec["status"] == "present"
        assert rec["check_in"]
        assert rec["check_out"] is None
        assert rec["location_in"] == "HQ"

    def test_check_in_twice_returns_400(self, att_user_token):
        token, _uid, _e = att_user_token
        r = requests.post(f"{API}/attendance/check-in", headers=_h(token), json={}, timeout=10)
        assert r.status_code == 400
        assert "Already checked in" in r.json().get("detail", "")

    def test_today_returns_record(self, att_user_token):
        token, uid, _e = att_user_token
        r = requests.get(f"{API}/attendance/today", headers=_h(token), timeout=10)
        assert r.status_code == 200
        rec = r.json()
        assert rec.get("user_id") == uid
        assert rec.get("check_in")

    def test_check_out_success(self, att_user_token):
        token, _uid, _e = att_user_token
        r = requests.post(f"{API}/attendance/check-out", headers=_h(token), json={"location": "HQ-Out"}, timeout=10)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["check_out"]
        assert rec["location_out"] == "HQ-Out"
        assert "hours" in rec
        assert isinstance(rec["hours"], (int, float))

    def test_check_out_twice_returns_400(self, att_user_token):
        token, _uid, _e = att_user_token
        r = requests.post(f"{API}/attendance/check-out", headers=_h(token), json={}, timeout=10)
        assert r.status_code == 400

    def test_attendance_me_returns_history(self, att_user_token):
        token, uid, _e = att_user_token
        r = requests.get(f"{API}/attendance/me", headers=_h(token), timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 1
        assert all(i["user_id"] == uid for i in items)


class TestAttendanceCheckOutWithoutCheckIn:
    def test_check_out_without_check_in(self, admin_token, created_users_cleanup):
        unique = uuid.uuid4().hex[:8]
        email = f"TESTU_nci_{unique}@example.com"
        pw = "NoCi@123"
        r = requests.post(f"{API}/users", headers=_h(admin_token), json={
            "email": email, "password": pw, "name": "NoCI", "role": "verifier"
        }, timeout=10)
        assert r.status_code == 200
        created_users_cleanup.append(r.json()["id"])
        login = _login_creds(email, pw)
        token = login.json()["token"]
        rco = requests.post(f"{API}/attendance/check-out", headers=_h(token), json={}, timeout=10)
        assert rco.status_code == 400
        assert "Not checked in" in rco.json().get("detail", "")


class TestAttendanceAdmin:
    def test_admin_list_attendance(self, admin_token, att_user_token):
        # att_user_token has produced today's record
        today = datetime.now(timezone.utc).date().isoformat()
        r = requests.get(
            f"{API}/attendance",
            headers=_h(admin_token),
            params={"from_date": today, "to_date": today},
            timeout=15,
        )
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        # Should contain at least our attendance record
        _, uid, _ = att_user_token
        found = [i for i in items if i["user_id"] == uid and i["date"] == today]
        assert len(found) >= 1, f"Expected today's record for {uid} in admin list"

    def test_admin_update_attendance_status(self, admin_token, att_user_token):
        today = datetime.now(timezone.utc).date().isoformat()
        _, uid, _ = att_user_token
        items = requests.get(
            f"{API}/attendance",
            headers=_h(admin_token),
            params={"from_date": today, "to_date": today},
            timeout=10,
        ).json()
        target = next((i for i in items if i["user_id"] == uid), None)
        assert target is not None
        att_id = target["id"]

        # Update to 'late'
        r = requests.put(
            f"{API}/attendance/{att_id}",
            headers=_h(admin_token),
            json={"status": "late", "notes": "TESTU adjusted"},
            timeout=10,
        )
        assert r.status_code == 200
        updated = r.json()
        assert updated["status"] == "late"
        assert updated.get("notes") == "TESTU adjusted"

        # Update to 'absent'
        r2 = requests.put(
            f"{API}/attendance/{att_id}",
            headers=_h(admin_token),
            json={"status": "absent"},
            timeout=10,
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "absent"

        # Update back to 'present'
        r3 = requests.put(
            f"{API}/attendance/{att_id}",
            headers=_h(admin_token),
            json={"status": "present"},
            timeout=10,
        )
        assert r3.status_code == 200
        assert r3.json()["status"] == "present"


class TestAttendancePayroll:
    def test_payroll_admin_only(self, fc_token):
        today = datetime.now(timezone.utc).date().isoformat()
        r = requests.get(
            f"{API}/attendance/payroll",
            headers=_h(fc_token),
            params={"from_date": today, "to_date": today},
            timeout=10,
        )
        assert r.status_code == 403

    def test_payroll_computation(self, admin_token, att_user_token):
        token, uid, _e = att_user_token
        today = datetime.now(timezone.utc).date().isoformat()

        # Ensure record exists & status known - reset via admin to 'present'
        items = requests.get(
            f"{API}/attendance",
            headers=_h(admin_token),
            params={"from_date": today, "to_date": today},
            timeout=10,
        ).json()
        rec = next((i for i in items if i["user_id"] == uid), None)
        assert rec is not None
        # Set status to present for predictable payroll
        requests.put(
            f"{API}/attendance/{rec['id']}",
            headers=_h(admin_token),
            json={"status": "present"},
            timeout=10,
        )

        r = requests.get(
            f"{API}/attendance/payroll",
            headers=_h(admin_token),
            params={"from_date": today, "to_date": today, "daily_rate": 750.0},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["daily_rate"] == 750.0
        assert body["from"] == today
        assert body["to"] == today
        assert "items" in body
        my = next((i for i in body["items"] if i["user_id"] == uid), None)
        assert my is not None, f"Payroll missing user {uid}"
        assert my["days_present"] == 1
        assert my["days_absent"] == 0
        assert my["days_late"] == 0
        # gross_pay = (present + late) * daily_rate = 1 * 750 = 750
        assert my["gross_pay"] == 750.0
        assert "total_hours" in my

    def test_payroll_default_daily_rate(self, admin_token):
        today = datetime.now(timezone.utc).date().isoformat()
        r = requests.get(
            f"{API}/attendance/payroll",
            headers=_h(admin_token),
            params={"from_date": today, "to_date": today},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["daily_rate"] == 500.0

    def test_payroll_late_counts_in_gross(self, admin_token, att_user_token):
        """Set status to late and verify it's still counted in gross_pay."""
        token, uid, _e = att_user_token
        today = datetime.now(timezone.utc).date().isoformat()
        items = requests.get(
            f"{API}/attendance",
            headers=_h(admin_token),
            params={"from_date": today, "to_date": today},
            timeout=10,
        ).json()
        rec = next((i for i in items if i["user_id"] == uid), None)
        assert rec is not None
        requests.put(
            f"{API}/attendance/{rec['id']}",
            headers=_h(admin_token),
            json={"status": "late"},
            timeout=10,
        )
        r = requests.get(
            f"{API}/attendance/payroll",
            headers=_h(admin_token),
            params={"from_date": today, "to_date": today, "daily_rate": 500.0},
            timeout=10,
        )
        assert r.status_code == 200
        my = next((i for i in r.json()["items"] if i["user_id"] == uid), None)
        assert my is not None
        assert my["days_late"] == 1
        assert my["days_present"] == 0
        assert my["gross_pay"] == 500.0

        # Set to absent and verify gross_pay drops to 0 for this user
        requests.put(
            f"{API}/attendance/{rec['id']}",
            headers=_h(admin_token),
            json={"status": "absent"},
            timeout=10,
        )
        r2 = requests.get(
            f"{API}/attendance/payroll",
            headers=_h(admin_token),
            params={"from_date": today, "to_date": today, "daily_rate": 500.0},
            timeout=10,
        )
        my2 = next((i for i in r2.json()["items"] if i["user_id"] == uid), None)
        assert my2 is not None
        assert my2["days_absent"] == 1
        assert my2["gross_pay"] == 0.0
