"""EFCIS LMS - Financial Management backend tests.

Covers:
- /api/financial/balances (admin/AM/BA only)
- /api/financial/transactions POST/GET (BA pending, admin auto-validated, AM forbidden, FC forbidden)
- /api/financial/transactions/{id}/validate (AM/admin)
- /api/financial/transfer (admin only)
- Activity log entries for financial actions
- Auth 401 enforcement

Tests use a unique reference_id token per test session to filter test rows.
"""
import os
import uuid
import time
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
    "area_manager": ("am.lucena@gmail.com", "Am@lucena12345"),
}

# Unique tag for this test run; used as category prefix or reference_id
RUN_TAG = f"TESTFIN_{uuid.uuid4().hex[:8]}"


def _login(role):
    email, pw = CREDS[role]
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, f"{role} login failed: {r.text}"
    return r.json()["token"]


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Module fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    return _login("admin")


@pytest.fixture(scope="module")
def ba_token():
    return _login("branch_assistant")


@pytest.fixture(scope="module")
def am_token():
    return _login("area_manager")


@pytest.fixture(scope="module")
def fc_token():
    return _login("field_collector")


# ---------- Auth / role enforcement ----------
class TestAuthAndRoles:
    def test_balances_requires_auth(self):
        r = requests.get(f"{API}/financial/balances", timeout=20)
        assert r.status_code == 401

    def test_list_tx_requires_auth(self):
        r = requests.get(f"{API}/financial/transactions", timeout=20)
        assert r.status_code == 401

    def test_create_tx_requires_auth(self):
        r = requests.post(f"{API}/financial/transactions", json={"type": "revenue", "account": "cash", "amount": 1}, timeout=20)
        assert r.status_code == 401

    def test_validate_requires_auth(self):
        r = requests.post(f"{API}/financial/transactions/nonexistent/validate", json={}, timeout=20)
        assert r.status_code == 401

    def test_transfer_requires_auth(self):
        r = requests.post(f"{API}/financial/transfer", json={"from": "cash", "to": "bank", "amount": 10}, timeout=20)
        assert r.status_code == 401

    def test_field_collector_forbidden_balances(self, fc_token):
        r = requests.get(f"{API}/financial/balances", headers=_h(fc_token), timeout=20)
        assert r.status_code == 403

    def test_field_collector_forbidden_list(self, fc_token):
        r = requests.get(f"{API}/financial/transactions", headers=_h(fc_token), timeout=20)
        assert r.status_code == 403

    def test_field_collector_forbidden_create(self, fc_token):
        r = requests.post(f"{API}/financial/transactions", headers=_h(fc_token),
                          json={"type": "revenue", "account": "cash", "amount": 1}, timeout=20)
        assert r.status_code == 403

    def test_field_collector_forbidden_transfer(self, fc_token):
        r = requests.post(f"{API}/financial/transfer", headers=_h(fc_token),
                          json={"from": "cash", "to": "bank", "amount": 1}, timeout=20)
        assert r.status_code == 403

    def test_am_forbidden_create(self, am_token):
        # AM can only validate, not create
        r = requests.post(f"{API}/financial/transactions", headers=_h(am_token),
                          json={"type": "revenue", "account": "cash", "amount": 100, "category": RUN_TAG}, timeout=20)
        assert r.status_code == 403

    def test_am_forbidden_transfer(self, am_token):
        r = requests.post(f"{API}/financial/transfer", headers=_h(am_token),
                          json={"from": "cash", "to": "bank", "amount": 10}, timeout=20)
        assert r.status_code == 403

    def test_ba_forbidden_transfer(self, ba_token):
        r = requests.post(f"{API}/financial/transfer", headers=_h(ba_token),
                          json={"from": "cash", "to": "bank", "amount": 10}, timeout=20)
        assert r.status_code == 403

    def test_ba_allowed_balances(self, ba_token):
        r = requests.get(f"{API}/financial/balances", headers=_h(ba_token), timeout=20)
        assert r.status_code == 200
        body = r.json()
        for k in ("cash", "bank", "total"):
            assert k in body


# ---------- Validation errors ----------
class TestCreateValidation:
    def test_invalid_type(self, ba_token):
        r = requests.post(f"{API}/financial/transactions", headers=_h(ba_token),
                          json={"type": "garbage", "account": "cash", "amount": 1}, timeout=20)
        assert r.status_code == 400

    def test_invalid_account(self, ba_token):
        r = requests.post(f"{API}/financial/transactions", headers=_h(ba_token),
                          json={"type": "revenue", "account": "gold", "amount": 1}, timeout=20)
        assert r.status_code == 400

    def test_zero_amount(self, ba_token):
        r = requests.post(f"{API}/financial/transactions", headers=_h(ba_token),
                          json={"type": "revenue", "account": "cash", "amount": 0}, timeout=20)
        assert r.status_code == 400

    def test_negative_amount(self, ba_token):
        r = requests.post(f"{API}/financial/transactions", headers=_h(ba_token),
                          json={"type": "revenue", "account": "cash", "amount": -5}, timeout=20)
        assert r.status_code == 400


# ---------- Create / Validate flow ----------
class TestCreateAndValidate:
    def test_ba_creates_pending(self, ba_token):
        payload = {"type": "revenue", "account": "cash", "amount": 250.0,
                   "category": RUN_TAG, "description": "ba pending revenue cash"}
        r = requests.post(f"{API}/financial/transactions", headers=_h(ba_token), json=payload, timeout=20)
        assert r.status_code == 200, r.text
        tx = r.json()
        assert tx["status"] == "pending"
        assert tx["type"] == "revenue"
        assert tx["account"] == "cash"
        assert tx["amount"] == 250.0
        assert tx["cash_delta"] == 250.0
        assert tx["bank_delta"] == 0.0
        assert tx.get("validated_by") in (None, "")
        # GET to verify persistence
        g = requests.get(f"{API}/financial/transactions?status=pending", headers=_h(ba_token), timeout=20)
        assert g.status_code == 200
        ids = [t["id"] for t in g.json()]
        assert tx["id"] in ids

    def test_admin_creates_auto_validated(self, admin_token):
        payload = {"type": "expense", "account": "bank", "amount": 75.5,
                   "category": RUN_TAG, "description": "admin auto-validated expense bank"}
        r = requests.post(f"{API}/financial/transactions", headers=_h(admin_token), json=payload, timeout=20)
        assert r.status_code == 200, r.text
        tx = r.json()
        assert tx["status"] == "validated"
        assert tx["cash_delta"] == 0.0
        assert tx["bank_delta"] == -75.5
        assert tx["validated_by"] is not None

    def test_disbursement_cash_delta_signs(self, admin_token):
        r = requests.post(f"{API}/financial/transactions", headers=_h(admin_token),
                          json={"type": "disbursement", "account": "cash", "amount": 40,
                                "category": RUN_TAG}, timeout=20)
        assert r.status_code == 200, r.text
        tx = r.json()
        assert tx["cash_delta"] == -40.0
        assert tx["bank_delta"] == 0.0

    def test_revenue_bank_delta(self, admin_token):
        r = requests.post(f"{API}/financial/transactions", headers=_h(admin_token),
                          json={"type": "revenue", "account": "bank", "amount": 10,
                                "category": RUN_TAG}, timeout=20)
        assert r.status_code == 200
        tx = r.json()
        assert tx["cash_delta"] == 0.0 and tx["bank_delta"] == 10.0

    def test_am_validates_pending(self, ba_token, am_token):
        # BA creates
        c = requests.post(f"{API}/financial/transactions", headers=_h(ba_token),
                          json={"type": "revenue", "account": "cash", "amount": 100,
                                "category": RUN_TAG, "description": "to validate"}, timeout=20)
        assert c.status_code == 200
        tx_id = c.json()["id"]
        # AM validates
        v = requests.post(f"{API}/financial/transactions/{tx_id}/validate", headers=_h(am_token),
                          json={"decision": "validated"}, timeout=20)
        assert v.status_code == 200, v.text
        assert v.json()["status"] == "validated"
        # Second validate -> 400 already validated
        v2 = requests.post(f"{API}/financial/transactions/{tx_id}/validate", headers=_h(am_token),
                           json={"decision": "validated"}, timeout=20)
        assert v2.status_code == 400

    def test_am_rejects_pending(self, ba_token, am_token):
        c = requests.post(f"{API}/financial/transactions", headers=_h(ba_token),
                          json={"type": "expense", "account": "cash", "amount": 33,
                                "category": RUN_TAG, "description": "to reject"}, timeout=20)
        assert c.status_code == 200
        tx_id = c.json()["id"]
        v = requests.post(f"{API}/financial/transactions/{tx_id}/validate", headers=_h(am_token),
                          json={"decision": "rejected"}, timeout=20)
        assert v.status_code == 200
        assert v.json()["status"] == "rejected"

    def test_ba_cannot_validate(self, ba_token):
        c = requests.post(f"{API}/financial/transactions", headers=_h(ba_token),
                          json={"type": "revenue", "account": "cash", "amount": 1,
                                "category": RUN_TAG}, timeout=20)
        assert c.status_code == 200
        tx_id = c.json()["id"]
        r = requests.post(f"{API}/financial/transactions/{tx_id}/validate", headers=_h(ba_token),
                          json={"decision": "validated"}, timeout=20)
        assert r.status_code == 403


# ---------- Transfer ----------
class TestTransfer:
    def test_transfer_cash_to_bank(self, admin_token):
        r = requests.post(f"{API}/financial/transfer", headers=_h(admin_token),
                          json={"from": "cash", "to": "bank", "amount": 60,
                                "description": f"{RUN_TAG} c2b"}, timeout=20)
        assert r.status_code == 200, r.text
        tx = r.json()
        assert tx["status"] == "validated"
        assert tx["type"] == "deposit"
        assert tx["cash_delta"] == -60.0
        assert tx["bank_delta"] == 60.0

    def test_transfer_bank_to_cash(self, admin_token):
        r = requests.post(f"{API}/financial/transfer", headers=_h(admin_token),
                          json={"from": "bank", "to": "cash", "amount": 20,
                                "description": f"{RUN_TAG} b2c"}, timeout=20)
        assert r.status_code == 200
        tx = r.json()
        assert tx["type"] == "withdrawal"
        assert tx["cash_delta"] == 20.0
        assert tx["bank_delta"] == -20.0

    def test_transfer_same_account(self, admin_token):
        r = requests.post(f"{API}/financial/transfer", headers=_h(admin_token),
                          json={"from": "cash", "to": "cash", "amount": 1}, timeout=20)
        assert r.status_code == 400

    def test_transfer_invalid_account(self, admin_token):
        r = requests.post(f"{API}/financial/transfer", headers=_h(admin_token),
                          json={"from": "wallet", "to": "bank", "amount": 1}, timeout=20)
        assert r.status_code == 400

    def test_transfer_invalid_amount(self, admin_token):
        r = requests.post(f"{API}/financial/transfer", headers=_h(admin_token),
                          json={"from": "cash", "to": "bank", "amount": 0}, timeout=20)
        assert r.status_code == 400


# ---------- Balances reflect only validated ----------
class TestBalances:
    def test_balances_reflect_only_validated(self, admin_token, ba_token):
        # snapshot initial balances
        b0 = requests.get(f"{API}/financial/balances", headers=_h(admin_token), timeout=20).json()
        cash0, bank0 = b0["cash"], b0["bank"]
        # BA pending revenue+cash 500: must NOT affect balance
        c = requests.post(f"{API}/financial/transactions", headers=_h(ba_token),
                          json={"type": "revenue", "account": "cash", "amount": 500,
                                "category": RUN_TAG, "description": "pending no-effect"}, timeout=20)
        assert c.status_code == 200
        b1 = requests.get(f"{API}/financial/balances", headers=_h(admin_token), timeout=20).json()
        assert b1["cash"] == cash0, f"pending tx affected cash: {cash0} -> {b1['cash']}"
        assert b1["bank"] == bank0
        # Admin direct validated expense bank 100 => bank decreases by 100
        c2 = requests.post(f"{API}/financial/transactions", headers=_h(admin_token),
                           json={"type": "expense", "account": "bank", "amount": 100,
                                 "category": RUN_TAG}, timeout=20)
        assert c2.status_code == 200
        b2 = requests.get(f"{API}/financial/balances", headers=_h(admin_token), timeout=20).json()
        assert round(b2["bank"] - bank0, 2) == -100.0, f"expected bank delta -100 got {b2['bank']-bank0}"
        assert b2["cash"] == cash0
        assert round(b2["total"], 2) == round(b2["cash"] + b2["bank"], 2)

    def test_rejected_does_not_affect(self, admin_token, ba_token, am_token):
        b0 = requests.get(f"{API}/financial/balances", headers=_h(admin_token), timeout=20).json()
        c = requests.post(f"{API}/financial/transactions", headers=_h(ba_token),
                          json={"type": "revenue", "account": "cash", "amount": 999,
                                "category": RUN_TAG}, timeout=20)
        tx_id = c.json()["id"]
        v = requests.post(f"{API}/financial/transactions/{tx_id}/validate", headers=_h(am_token),
                          json={"decision": "rejected"}, timeout=20)
        assert v.status_code == 200
        b1 = requests.get(f"{API}/financial/balances", headers=_h(admin_token), timeout=20).json()
        assert b1["cash"] == b0["cash"] and b1["bank"] == b0["bank"]


# ---------- Filters ----------
class TestFilters:
    def test_filter_by_status_pending(self, ba_token):
        r = requests.get(f"{API}/financial/transactions?status=pending", headers=_h(ba_token), timeout=20)
        assert r.status_code == 200
        items = r.json()
        assert all(t["status"] == "pending" for t in items)

    def test_filter_by_type_revenue(self, ba_token):
        r = requests.get(f"{API}/financial/transactions?type=revenue", headers=_h(ba_token), timeout=20)
        assert r.status_code == 200
        items = r.json()
        assert all(t["type"] == "revenue" for t in items)

    def test_filter_by_date_range(self, ba_token):
        # use today as from_date; should include the txs created this run
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = requests.get(f"{API}/financial/transactions?from_date={today}", headers=_h(ba_token), timeout=20)
        assert r.status_code == 200
        items = r.json()
        # at least one should match our RUN_TAG
        matching = [t for t in items if (t.get("category") or "").startswith("TESTFIN_") or (t.get("description") or "").find(RUN_TAG) >= 0]
        assert len(matching) >= 1


# ---------- Activity log ----------
class TestActivityLog:
    def test_financial_events_logged(self, admin_token, ba_token, am_token):
        # Create a uniquely tagged pending then validate, then transfer
        c = requests.post(f"{API}/financial/transactions", headers=_h(ba_token),
                          json={"type": "revenue", "account": "cash", "amount": 11,
                                "category": RUN_TAG, "description": "activity-log test"}, timeout=20)
        assert c.status_code == 200
        tx_id = c.json()["id"]
        v = requests.post(f"{API}/financial/transactions/{tx_id}/validate", headers=_h(am_token),
                          json={"decision": "validated"}, timeout=20)
        assert v.status_code == 200
        t = requests.post(f"{API}/financial/transfer", headers=_h(admin_token),
                          json={"from": "cash", "to": "bank", "amount": 5,
                                "description": f"{RUN_TAG} log-test transfer"}, timeout=20)
        assert t.status_code == 200
        time.sleep(0.5)

        # Verify activity logs contain financial events
        actions_to_check = ["financial.tx_create", "financial.tx_validated", "financial.deposit"]
        found = {}
        for action in actions_to_check:
            r = requests.get(f"{API}/activity-logs?action={action}&limit=200",
                             headers=_h(admin_token), timeout=20)
            assert r.status_code == 200, f"activity-logs fetch failed for {action}"
            logs = r.json()
            found[action] = len(logs)
            assert len(logs) >= 1, f"No activity log entries for action={action}"

    def test_activity_log_admin_only(self, ba_token):
        r = requests.get(f"{API}/activity-logs", headers=_h(ba_token), timeout=20)
        assert r.status_code == 403
