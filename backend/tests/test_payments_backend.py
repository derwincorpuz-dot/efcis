"""EFCIS LMS - Payments daily-schedule backend tests.

Covers /api/payments/daily, /collect, /pass, /loan/{loan_id}.
Builds a fresh end-to-end loan: FC create -> BA Processed -> BM Reviewed
(approved_amount=10000, approved_terms=60) -> V Verified -> AM Approved
-> Admin Scheduled (release_date=today) -> RO Released.
Then exercises the new payment endpoints.
"""
import os
from datetime import date, datetime, timedelta, timezone
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
    "branch_manager": ("bm.lucena@gmail.com", "Bm@lucena12345"),
    "verifier": ("v.lucena@gmail.com", "V@lucena12345"),
    "area_manager": ("am.lucena@gmail.com", "Am@lucena12345"),
    "releasing_officer": ("r.lucena@gmail.com", "R@lucena12345"),
}


def _login(role):
    email, pw = CREDS[role]
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, f"{role} login failed: {r.text}"
    body = r.json()
    return body["token"], body["user"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Shared fixture: build a fresh released loan ----------
@pytest.fixture(scope="module")
def released_loan():
    """Create a fresh loan and walk it through FC->BA->BM->V->AM->Admin->RO release.

    Returns dict with token bundle + the released loan_id and release_date string.
    """
    tokens = {role: _login(role)[0] for role in CREDS}
    fc_user = _login("field_collector")[1]

    # 1) FC create
    r = requests.post(
        f"{API}/loan-applications",
        json={
            "data": {
                "first_name": "PAYTEST_Pedro",
                "middle_name": "P",
                "surname": "Santos",
                "contact_no": "09171239999",
                "present_address": "Lucena City - PAYTEST",
                "collector_name": fc_user["name"],
            },
            "status": "New loan",
        },
        headers=_h(tokens["field_collector"]),
        timeout=20,
    )
    assert r.status_code == 200, r.text
    app = r.json()
    app_id = app["id"]

    # 2) BA Processed: amount_applied + applied_terms
    r = requests.put(
        f"{API}/loan-applications/{app_id}",
        json={
            "status": "Processed",
            "data": {"amount_applied": 10000, "applied_terms": 60},
        },
        headers=_h(tokens["branch_assistant"]),
        timeout=20,
    )
    assert r.status_code == 200, r.text

    # 3) BM Reviewed: approved_amount + approved_terms
    r = requests.put(
        f"{API}/loan-applications/{app_id}",
        json={
            "status": "Reviewed",
            "data": {"approved_amount": 10000, "approved_terms": 60},
        },
        headers=_h(tokens["branch_manager"]),
        timeout=20,
    )
    assert r.status_code == 200, r.text

    # 4) V Verified
    r = requests.put(
        f"{API}/loan-applications/{app_id}",
        json={"status": "Verified"},
        headers=_h(tokens["verifier"]),
        timeout=20,
    )
    assert r.status_code == 200, r.text

    # 5) AM Approved
    r = requests.put(
        f"{API}/loan-applications/{app_id}",
        json={"status": "Approved"},
        headers=_h(tokens["area_manager"]),
        timeout=20,
    )
    assert r.status_code == 200, r.text

    # 6) Admin Scheduled with release_date=today
    today_iso = date.today().isoformat()
    r = requests.put(
        f"{API}/loan-applications/{app_id}",
        json={"status": "Scheduled", "data": {"release_date": today_iso}},
        headers=_h(tokens["admin"]),
        timeout=20,
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"].get("release_date") == today_iso

    # 7) RO Released
    r = requests.post(
        f"{API}/loan-applications/{app_id}/release",
        json={"release_note": "PAYTEST released"},
        headers=_h(tokens["releasing_officer"]),
        timeout=20,
    )
    assert r.status_code == 200, r.text

    # Verify in loan_management
    g = requests.get(f"{API}/loan-management/{app_id}", headers=_h(tokens["admin"]), timeout=20)
    assert g.status_code == 200
    rec = g.json()
    assert rec["status"] == "Released"
    assert rec["data"].get("release_date") == today_iso
    assert rec["data"].get("approved_amount") in (10000, 10000.0)
    assert rec["data"].get("approved_terms") in (60, "60")

    return {
        "tokens": tokens,
        "loan_id": app_id,
        "control_no": rec["control_no"],
        "release_date": today_iso,
    }


# ---------- Auth gating ----------
@pytest.mark.parametrize("path", [
    "/payments/daily",
    "/payments/collect",
    "/payments/pass",
    "/payments/loan/anyid",
])
def test_payments_require_auth(path):
    if path.endswith("collect") or path.endswith("pass"):
        r = requests.post(f"{API}{path}", json={}, timeout=20)
    else:
        r = requests.get(f"{API}{path}", timeout=20)
    assert r.status_code == 401, f"{path} expected 401 got {r.status_code}"


# ---------- /payments/daily ----------
def test_daily_returns_row_for_released_loan_day1_tomorrow(released_loan):
    """After releasing today, daily?date=tomorrow should include day=1 row for the loan."""
    tok = released_loan["tokens"]["admin"]
    loan_id = released_loan["loan_id"]
    today = date.fromisoformat(released_loan["release_date"])
    tomorrow = (today + timedelta(days=1)).isoformat()

    r = requests.get(
        f"{API}/payments/daily",
        params={"date": tomorrow, "include_outstanding": "true"},
        headers=_h(tok), timeout=20,
    )
    assert r.status_code == 200, r.text
    rows = r.json()
    assert isinstance(rows, list)
    mine = [x for x in rows if x["loan_id"] == loan_id]
    assert len(mine) >= 1, f"no row for loan {loan_id} on {tomorrow}; rows={rows[:3]}"
    row = next(x for x in mine if x["day"] == 1)

    # Required fields
    for k in ["loan_id", "control_no", "borrower_name", "day", "due_date",
              "amount", "status", "contact_no", "address",
              "receipt_no", "action_at", "action_by_name"]:
        assert k in row, f"missing field {k} in row {row}"

    assert row["control_no"] == released_loan["control_no"]
    assert row["due_date"] == tomorrow
    assert row["status"] == "pending"
    assert row["receipt_no"] is None
    # daily for 60d 20% on 10000 = 12000/60 = 200
    assert round(float(row["amount"]), 2) == 200.00
    assert "PAYTEST_Pedro" in row["borrower_name"]
    assert "_id" not in row


def test_daily_only_lists_released_loans(released_loan):
    tok = released_loan["tokens"]["admin"]
    today = date.fromisoformat(released_loan["release_date"])
    # Pick a date far in the future where include_outstanding still won't include it
    far = (today + timedelta(days=2)).isoformat()
    r = requests.get(f"{API}/payments/daily", params={"date": far}, headers=_h(tok), timeout=20)
    assert r.status_code == 200
    for row in r.json():
        # all rows should reference loans (Released only) - we verify status field is one of pending/paid/outstanding
        assert row["status"] in ("pending", "paid", "outstanding")
        assert "_id" not in row


# ---------- /payments/collect ----------
def test_collect_creates_paid_record_with_receipt(released_loan):
    tok = released_loan["tokens"]["admin"]
    loan_id = released_loan["loan_id"]
    payload = {"loan_id": loan_id, "day": 1, "amount": 200}
    r = requests.post(f"{API}/payments/collect", json=payload, headers=_h(tok), timeout=20)
    assert r.status_code == 200, r.text
    rec = r.json()
    assert rec["status"] == "paid"
    assert rec["loan_id"] == loan_id
    assert rec["day"] == 1
    rn = rec["receipt_no"]
    assert rn.startswith("OR-"), rn
    parts = rn.split("-")
    assert len(parts) == 3
    assert len(parts[1]) == 8 and parts[1].isdigit()  # YYYYMMDD
    assert len(parts[2]) == 4 and parts[2].isdigit()  # 4-digit counter
    assert "_id" not in rec

    # GET-verify via /payments/loan/{loan_id}
    g = requests.get(f"{API}/payments/loan/{loan_id}", headers=_h(tok), timeout=20)
    assert g.status_code == 200
    rows = g.json()
    day1 = next(x for x in rows if x["day"] == 1)
    assert day1["status"] == "paid"
    assert day1["receipt_no"] == rn


def test_pass_after_collect_returns_400(released_loan):
    """Per spec: /pass on already-paid (loan_id, day) -> 400 'Already paid'."""
    tok = released_loan["tokens"]["admin"]
    loan_id = released_loan["loan_id"]
    r = requests.post(
        f"{API}/payments/pass",
        json={"loan_id": loan_id, "day": 1, "amount": 200, "reason": "should fail"},
        headers=_h(tok), timeout=20,
    )
    assert r.status_code == 400, r.text
    body = r.json()
    msg = body.get("detail") or body.get("message") or ""
    assert "paid" in str(msg).lower()


# ---------- /payments/pass then /collect (idempotent upgrade) ----------
def test_pass_then_collect_upgrades_to_paid(released_loan):
    tok = released_loan["tokens"]["admin"]
    loan_id = released_loan["loan_id"]
    # Pass on day=2 first
    r = requests.post(
        f"{API}/payments/pass",
        json={"loan_id": loan_id, "day": 2, "amount": 200, "reason": "borrower absent"},
        headers=_h(tok), timeout=20,
    )
    assert r.status_code == 200, r.text
    rec = r.json()
    assert rec["status"] == "outstanding"
    assert rec["loan_id"] == loan_id
    assert rec["day"] == 2
    assert rec.get("notes") == "borrower absent"

    # Now collect on day=2 - should update existing record to paid
    r = requests.post(
        f"{API}/payments/collect",
        json={"loan_id": loan_id, "day": 2, "amount": 200},
        headers=_h(tok), timeout=20,
    )
    assert r.status_code == 200, r.text
    rec2 = r.json()
    assert rec2["status"] == "paid"
    assert rec2["receipt_no"] and rec2["receipt_no"].startswith("OR-")

    # Verify only ONE record persists for (loan_id, day=2): /loan endpoint should reflect single status=paid
    g = requests.get(f"{API}/payments/loan/{loan_id}", headers=_h(tok), timeout=20)
    assert g.status_code == 200
    rows = g.json()
    day2 = [x for x in rows if x["day"] == 2]
    assert len(day2) == 1
    assert day2[0]["status"] == "paid"


def test_collect_idempotent_on_same_day(released_loan):
    """Second /collect on same (loan_id, day) updates same record, not duplicates."""
    tok = released_loan["tokens"]["admin"]
    loan_id = released_loan["loan_id"]
    # day=3 fresh: collect twice
    r1 = requests.post(
        f"{API}/payments/collect",
        json={"loan_id": loan_id, "day": 3, "amount": 200},
        headers=_h(tok), timeout=20,
    )
    assert r1.status_code == 200
    r2 = requests.post(
        f"{API}/payments/collect",
        json={"loan_id": loan_id, "day": 3, "amount": 200},
        headers=_h(tok), timeout=20,
    )
    assert r2.status_code == 200
    g = requests.get(f"{API}/payments/loan/{loan_id}", headers=_h(tok), timeout=20)
    rows = g.json()
    day3 = [x for x in rows if x["day"] == 3]
    assert len(day3) == 1
    assert day3[0]["status"] == "paid"


# ---------- /payments/loan/{loan_id} ----------
def test_loan_schedule_returns_full_terms(released_loan):
    tok = released_loan["tokens"]["admin"]
    loan_id = released_loan["loan_id"]
    r = requests.get(f"{API}/payments/loan/{loan_id}", headers=_h(tok), timeout=20)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert len(rows) == 60, f"expected 60 rows for terms=60, got {len(rows)}"
    days = sorted([x["day"] for x in rows])
    assert days == list(range(1, 61))
    # Each row has required fields incl. status
    for x in rows:
        for k in ["loan_id", "control_no", "borrower_name", "day", "due_date",
                  "amount", "status", "receipt_no", "action_at", "action_by_name"]:
            assert k in x
        assert "_id" not in x

    # day1, day2, day3 should be paid by now (from prior tests)
    by_day = {x["day"]: x for x in rows}
    assert by_day[1]["status"] == "paid"
    assert by_day[2]["status"] == "paid"
    assert by_day[3]["status"] == "paid"
    # day 4+ pending
    assert by_day[4]["status"] == "pending"


def test_loan_schedule_404_for_unknown(released_loan):
    tok = released_loan["tokens"]["admin"]
    r = requests.get(f"{API}/payments/loan/does-not-exist-xyz", headers=_h(tok), timeout=20)
    assert r.status_code == 404


# ---------- Outstanding rollup behavior ----------
def test_daily_outstanding_filtering(released_loan):
    """On a date 'after' due, an outstanding (unpaid) row should appear when include_outstanding=true,
    and be hidden when include_outstanding=false."""
    tok = released_loan["tokens"]["admin"]
    loan_id = released_loan["loan_id"]
    today = date.fromisoformat(released_loan["release_date"])

    # Pass day=4 (due_date = today + 4)
    r = requests.post(
        f"{API}/payments/pass",
        json={"loan_id": loan_id, "day": 4, "amount": 200, "reason": "no funds"},
        headers=_h(tok), timeout=20,
    )
    assert r.status_code == 200, r.text

    # Query daily on a date AFTER day=4's due_date (i.e. today+5 covers day=4 in past unpaid)
    future = (today + timedelta(days=5)).isoformat()
    r1 = requests.get(
        f"{API}/payments/daily",
        params={"date": future, "include_outstanding": "true"},
        headers=_h(tok), timeout=20,
    )
    assert r1.status_code == 200
    rows1 = r1.json()
    mine1 = [x for x in rows1 if x["loan_id"] == loan_id and x["day"] == 4]
    assert len(mine1) == 1
    assert mine1[0]["status"] == "outstanding"

    # With include_outstanding=false the past-unpaid day=4 should NOT show
    r2 = requests.get(
        f"{API}/payments/daily",
        params={"date": future, "include_outstanding": "false"},
        headers=_h(tok), timeout=20,
    )
    assert r2.status_code == 200
    rows2 = r2.json()
    mine2 = [x for x in rows2 if x["loan_id"] == loan_id and x["day"] == 4]
    assert len(mine2) == 0


# ---------- collect/pass validation ----------
def test_collect_requires_loan_id_and_day(released_loan):
    tok = released_loan["tokens"]["admin"]
    r = requests.post(f"{API}/payments/collect", json={"amount": 100}, headers=_h(tok), timeout=20)
    assert r.status_code in (400, 422)
