"""EFCIS LMS Backend Tests - Auth, Settings, Loan Application Workflow"""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("admin.system@gmail.com", "Systemdev0118"),
    "field_collector": ("fc.lucena@gmail.com", "FC@lucena12345"),
    "branch_assistant": ("assitant.lucena@gmail.com", "Assistant@lucena12345"),
    "branch_manager": ("bm.lucena@gmail.com", "Bm@lucena12345"),
    "verifier": ("v.lucena@gmail.com", "V@lucena12345"),
    "area_manager": ("am.lucena@gmail.com", "Am@lucena12345"),
    "releasing_officer": ("r.lucena@gmail.com", "R@lucena12345"),
}


def login(role: str):
    email, password = CREDS[role]
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {role}: {r.status_code} {r.text}"
    body = r.json()
    assert "token" in body and "user" in body
    return body["token"], body["user"]


def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


# ---------- Auth ----------
@pytest.mark.parametrize("role", list(CREDS.keys()))
def test_login_each_role(role):
    token, user = login(role)
    assert user["role"] == role
    assert user["email"] == CREDS[role][0]
    assert isinstance(token, str) and len(token) > 20
    # _id leak check
    assert "_id" not in user


def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": "admin.system@gmail.com", "password": "wrong"}, timeout=20)
    assert r.status_code == 401


def test_me_with_token():
    token, _ = login("admin")
    r = requests.get(f"{API}/auth/me", headers=auth_headers(token), timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert body["role"] == "admin"
    assert "_id" not in body


def test_me_without_token():
    r = requests.get(f"{API}/auth/me", timeout=20)
    assert r.status_code == 401


# ---------- Settings ----------
def test_get_settings_public():
    r = requests.get(f"{API}/settings", timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert "system_name" in body
    assert "_id" not in body


def test_put_settings_admin():
    token, _ = login("admin")
    payload = {"logo_data_url": "data:image/png;base64,iVBORw0KGgo=", "system_name": "EFCIS LMS"}
    r = requests.put(f"{API}/settings", json=payload, headers=auth_headers(token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["logo_data_url"] == payload["logo_data_url"]
    assert body["system_name"] == "EFCIS LMS"
    assert "_id" not in body


def test_put_settings_non_admin_forbidden():
    token, _ = login("field_collector")
    r = requests.put(f"{API}/settings", json={"system_name": "Hack"}, headers=auth_headers(token), timeout=20)
    assert r.status_code == 403


# ---------- Loan Application creation ----------
def test_fc_creates_application_with_control_no():
    token, fc = login("field_collector")
    body = {
        "data": {
            "first_name": "TEST_Juan",
            "middle_name": "M",
            "surname": "DelaCruz",
            "suffix": "",
            "contact_no": "09171234567",
            "present_address": "Lucena City",
            "collector_name": fc["name"],
        },
        "status": "New loan",
    }
    r = requests.post(f"{API}/loan-applications", json=body, headers=auth_headers(token), timeout=20)
    assert r.status_code == 200, r.text
    app = r.json()
    assert app["control_no"].startswith("EFCIS-")
    parts = app["control_no"].split("-")
    assert len(parts) == 3 and len(parts[1]) == 6 and len(parts[2]) == 5
    assert app["status"] == "New loan"
    assert app["first_name"] == "TEST_Juan"
    assert app["surname"] == "DelaCruz"
    assert app["created_by"] == fc["id"]
    assert "_id" not in app
    return app, token


def test_non_fc_cannot_create_application():
    for role in ["branch_assistant", "branch_manager", "verifier", "area_manager", "releasing_officer"]:
        token, _ = login(role)
        r = requests.post(
            f"{API}/loan-applications",
            json={"data": {"first_name": "X"}, "status": "Draft"},
            headers=auth_headers(token), timeout=20,
        )
        assert r.status_code == 403, f"{role} should be forbidden, got {r.status_code}"


def test_admin_can_create_application_due_to_admin_bypass():
    # admin bypasses require_roles -> admin should be allowed (per server logic)
    token, _ = login("admin")
    r = requests.post(
        f"{API}/loan-applications",
        json={"data": {"first_name": "TEST_AdminCreated"}, "status": "Draft"},
        headers=auth_headers(token), timeout=20,
    )
    # admin acts as super-user in require_roles dependency
    assert r.status_code == 200, r.text


# ---------- Listing visibility ----------
def test_list_applications_visibility():
    fc_token, fc = login("field_collector")
    admin_token, _ = login("admin")
    # FC only sees own
    r = requests.get(f"{API}/loan-applications", headers=auth_headers(fc_token), timeout=20)
    assert r.status_code == 200
    fc_items = r.json()
    for it in fc_items:
        assert it["created_by"] == fc["id"]
        assert "_id" not in it
    # Admin sees all
    r = requests.get(f"{API}/loan-applications", headers=auth_headers(admin_token), timeout=20)
    assert r.status_code == 200
    admin_items = r.json()
    assert len(admin_items) >= len(fc_items)


# ---------- Update (mirror fields) ----------
def test_update_mirrors_common_fields():
    token, fc = login("field_collector")
    create = requests.post(
        f"{API}/loan-applications",
        json={"data": {"first_name": "TEST_Mirror", "surname": "Old"}, "status": "Draft"},
        headers=auth_headers(token), timeout=20,
    ).json()
    app_id = create["id"]
    upd = requests.put(
        f"{API}/loan-applications/{app_id}",
        json={"data": {"surname": "NewSurname", "contact_no": "09998887777"}, "status": "New loan"},
        headers=auth_headers(token), timeout=20,
    )
    assert upd.status_code == 200
    body = upd.json()
    assert body["surname"] == "NewSurname"
    assert body["contact_no"] == "09998887777"
    assert body["status"] == "New loan"
    assert body["data"]["first_name"] == "TEST_Mirror"  # preserved
    assert "_id" not in body


# ---------- Full workflow ----------
def test_full_workflow_to_release():
    fc_token, fc = login("field_collector")
    ba_token, _ = login("branch_assistant")
    bm_token, _ = login("branch_manager")
    v_token, _ = login("verifier")
    am_token, _ = login("area_manager")
    admin_token, _ = login("admin")
    ro_token, _ = login("releasing_officer")

    # FC creates
    create = requests.post(
        f"{API}/loan-applications",
        json={
            "data": {
                "first_name": "TEST_Flow",
                "surname": "Release",
                "contact_no": "09171110000",
                "present_address": "Lucena",
                "collector_name": fc["name"],
            },
            "status": "New loan",
        },
        headers=auth_headers(fc_token), timeout=20,
    )
    assert create.status_code == 200, create.text
    app_id = create.json()["id"]

    transitions = [
        (ba_token, "Processed"),
        (bm_token, "Reviewed"),
        (v_token, "Verified"),
        (am_token, "Approved"),
        (admin_token, "Scheduled"),
    ]
    for tok, status in transitions:
        r = requests.put(
            f"{API}/loan-applications/{app_id}",
            json={"status": status, "data": {"step_status": status}},
            headers=auth_headers(tok), timeout=20,
        )
        assert r.status_code == 200, f"{status} failed: {r.text}"
        assert r.json()["status"] == status

    # RO releases
    rel = requests.post(
        f"{API}/loan-applications/{app_id}/release",
        json={"release_note": "ok"}, headers=auth_headers(ro_token), timeout=20,
    )
    assert rel.status_code == 200, rel.text

    # Removed from loan_applications
    g = requests.get(f"{API}/loan-applications/{app_id}", headers=auth_headers(admin_token), timeout=20)
    assert g.status_code == 404

    # Present in loan_management
    lm = requests.get(f"{API}/loan-management", headers=auth_headers(admin_token), timeout=20)
    assert lm.status_code == 200
    items = lm.json()
    found = [i for i in items if i["id"] == app_id]
    assert len(found) == 1
    rec = found[0]
    assert rec["status"] == "Released"
    assert rec["loan_status"] == "Ongoing"
    assert "_id" not in rec


def test_reject_workflow():
    fc_token, fc = login("field_collector")
    am_token, _ = login("area_manager")
    admin_token, _ = login("admin")
    ro_token, _ = login("releasing_officer")

    create = requests.post(
        f"{API}/loan-applications",
        json={"data": {"first_name": "TEST_Reject", "surname": "Apple"}, "status": "New loan"},
        headers=auth_headers(fc_token), timeout=20,
    )
    app_id = create.json()["id"]

    # Releasing officer should NOT be able to reject (require_roles area_manager, admin bypass only)
    r = requests.post(
        f"{API}/loan-applications/{app_id}/reject",
        json={"reason": "x"}, headers=auth_headers(ro_token), timeout=20,
    )
    assert r.status_code == 403

    # Area manager rejects
    r = requests.post(
        f"{API}/loan-applications/{app_id}/reject",
        json={"reason": "Insufficient docs"}, headers=auth_headers(am_token), timeout=20,
    )
    assert r.status_code == 200, r.text

    # Removed from apps
    g = requests.get(f"{API}/loan-applications/{app_id}", headers=auth_headers(admin_token), timeout=20)
    assert g.status_code == 404

    # Present in loan_management with status Rejected
    lm = requests.get(f"{API}/loan-management", headers=auth_headers(admin_token), timeout=20)
    rec = next((i for i in lm.json() if i["id"] == app_id), None)
    assert rec is not None
    assert rec["status"] == "Rejected"
    assert rec.get("rejection_reason") == "Insufficient docs"
    assert "_id" not in rec


def test_release_forbidden_for_non_releasing_officer():
    fc_token, _ = login("field_collector")
    bm_token, _ = login("branch_manager")
    create = requests.post(
        f"{API}/loan-applications",
        json={"data": {"first_name": "TEST_RelForbidden"}, "status": "New loan"},
        headers=auth_headers(fc_token), timeout=20,
    ).json()
    app_id = create["id"]
    r = requests.post(
        f"{API}/loan-applications/{app_id}/release",
        json={}, headers=auth_headers(bm_token), timeout=20,
    )
    assert r.status_code == 403
