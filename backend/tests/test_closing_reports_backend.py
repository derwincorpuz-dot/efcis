"""EFCIS LMS - Daily Closing Report + auto-revenue side-effect backend tests.

Covers:
- POST /api/payments/collect side-effect: pending revenue financial_transaction
- GET /api/closing-reports/preview
- POST /api/closing-reports (collector) + duplicate-day 400 + role gating
- POST /api/closing-reports/branch-rollup (BA) + empty/non-pending 400s
- POST /api/closing-reports/{id}/validate (AM): cascades + validates linked FTx
- decision='rejected' does NOT validate linked FTx
- GET /api/closing-reports filters + FC scoping
- 401 unauth + 403 role gating
- GET /api/payments/history-by-client structure & totals
"""
import os
import uuid
from datetime import date
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

TODAY_ISO = date.today().isoformat()


# ---------- helpers ----------
def _login(role):
    email, pw = CREDS[role]
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, f"{role} login failed: {r.text}"
    b = r.json()
    return b["token"], b["user"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- module fixtures ----------
@pytest.fixture(scope="module")
def tokens():
    return {role: _login(role)[0] for role in CREDS}


@pytest.fixture(scope="module")
def fc_user():
    return _login("field_collector")[1]


@pytest.fixture(scope="module")
def released_loan(tokens, fc_user):
    """Walk a fresh loan FC -> BA -> BM -> V -> AM -> Admin -> RO Released today."""
    suffix = uuid.uuid4().hex[:6].upper()
    r = requests.post(
        f"{API}/loan-applications",
        json={
            "data": {
                "first_name": f"CRTEST_{suffix}",
                "middle_name": "C",
                "surname": "Borrower",
                "contact_no": "09170000000",
                "present_address": "Lucena - CRTEST",
                "collector_name": fc_user["name"],
            },
            "status": "New loan",
        },
        headers=_h(tokens["field_collector"]),
        timeout=20,
    )
    assert r.status_code == 200, r.text
    app_id = r.json()["id"]

    steps = [
        ("branch_assistant", {"status": "Processed", "data": {"amount_applied": 10000, "applied_terms": 60}}),
        ("branch_manager", {"status": "Reviewed", "data": {"approved_amount": 10000, "approved_terms": 60}}),
        ("verifier", {"status": "Verified"}),
        ("area_manager", {"status": "Approved"}),
        ("admin", {"status": "Scheduled", "data": {"release_date": TODAY_ISO}}),
    ]
    for role, body in steps:
        r = requests.put(f"{API}/loan-applications/{app_id}", json=body, headers=_h(tokens[role]), timeout=20)
        assert r.status_code == 200, f"{role} step failed: {r.text}"

    r = requests.post(
        f"{API}/loan-applications/{app_id}/release",
        json={"release_note": "CRTEST released"},
        headers=_h(tokens["releasing_officer"]),
        timeout=20,
    )
    assert r.status_code == 200, r.text

    g = requests.get(f"{API}/loan-management/{app_id}", headers=_h(tokens["admin"]), timeout=20)
    assert g.status_code == 200
    rec = g.json()
    assert rec["status"] == "Released"
    return {"loan_id": app_id, "control_no": rec["control_no"]}


# ============================================================
# 1) /payments/collect auto-revenue side-effect
# ============================================================
class TestAutoRevenueOnCollect:
    def test_collect_creates_pending_revenue_tx(self, tokens, released_loan):
        loan_id = released_loan["loan_id"]
        # Collect day 1: 200
        r = requests.post(
            f"{API}/payments/collect",
            json={"loan_id": loan_id, "day": 1, "amount": 200, "notes": "CRTEST day1"},
            headers=_h(tokens["field_collector"]),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        pay = r.json()
        assert pay["status"] == "paid"
        assert pay["amount"] == 200
        payment_id = pay["id"]

        # Find the auto-posted pending revenue tx via reference_id
        r = requests.get(
            f"{API}/financial/transactions?status=pending&type=revenue&limit=500",
            headers=_h(tokens["admin"]),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        txs = r.json()
        match = [t for t in txs if t.get("reference_id") == payment_id]
        assert len(match) == 1, f"Expected 1 pending revenue tx for payment {payment_id}, got {len(match)}"
        ftx = match[0]
        assert ftx["status"] == "pending"
        assert ftx["type"] == "revenue"
        assert ftx["account"] == "cash"
        assert ftx["amount"] == 200
        assert ftx["reference_type"] == "payment"

    def test_collect_second_payment_creates_second_tx(self, tokens, released_loan):
        loan_id = released_loan["loan_id"]
        r = requests.post(
            f"{API}/payments/collect",
            json={"loan_id": loan_id, "day": 2, "amount": 200},
            headers=_h(tokens["field_collector"]),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        pay = r.json()
        # FTx exists for day 2 payment
        r = requests.get(
            f"{API}/financial/transactions?status=pending&type=revenue&limit=500",
            headers=_h(tokens["admin"]),
            timeout=20,
        )
        ids = {t.get("reference_id") for t in r.json()}
        assert pay["id"] in ids


# ============================================================
# 2) /payments/pass (does NOT create a revenue tx)
# ============================================================
class TestPassPayment:
    def test_pass_day_records_outstanding(self, tokens, released_loan):
        loan_id = released_loan["loan_id"]
        r = requests.post(
            f"{API}/payments/pass",
            json={"loan_id": loan_id, "day": 3, "amount": 200, "reason": "absent"},
            headers=_h(tokens["field_collector"]),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "outstanding"


# ============================================================
# 3) /closing-reports/preview
# ============================================================
class TestClosingPreview:
    def test_preview_returns_today_structure(self, tokens):
        r = requests.get(
            f"{API}/closing-reports/preview?date={TODAY_ISO}",
            headers=_h(tokens["field_collector"]),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ["date", "collector_id", "payment_ids", "totals", "items"]:
            assert k in body, f"Missing key {k}"
        for k in ["collected_amount", "passed_amount", "count_paid", "count_passed", "count_total"]:
            assert k in body["totals"], f"Missing totals.{k}"
        assert body["date"] == TODAY_ISO
        # At minimum 2 paid (200+200=400) + 1 passed (200), counts >= these
        assert body["totals"]["collected_amount"] >= 400
        assert body["totals"]["count_paid"] >= 2
        assert body["totals"]["count_passed"] >= 1

    def test_preview_unauth_401(self):
        r = requests.get(f"{API}/closing-reports/preview?date={TODAY_ISO}", timeout=20)
        assert r.status_code in (401, 403)


# ============================================================
# 4) POST /closing-reports  (collector submission)
# ============================================================
class TestCollectorClosingSubmit:
    @pytest.fixture(scope="class")
    def collector_report(self, tokens):
        r = requests.post(
            f"{API}/closing-reports",
            json={"date": TODAY_ISO, "notes": "CRTEST collector close"},
            headers=_h(tokens["field_collector"]),
            timeout=20,
        )
        # Could be 200 first time, or 400 if a previous run already submitted today
        if r.status_code == 400:
            # find the existing pending report
            lst = requests.get(
                f"{API}/closing-reports?type=collector&date={TODAY_ISO}",
                headers=_h(tokens["field_collector"]),
                timeout=20,
            ).json()
            assert lst, "expected existing collector report"
            return lst[0]
        assert r.status_code == 200, r.text
        return r.json()

    def test_collector_submit_shape(self, collector_report):
        for k in ["id", "type", "status", "date", "submitted_by", "payment_ids", "totals"]:
            assert k in collector_report, f"Missing {k}"
        assert collector_report["type"] == "collector"
        assert collector_report["status"] in ("pending", "submitted", "validated")
        assert collector_report["date"] == TODAY_ISO

    def test_duplicate_collector_submit_returns_400(self, tokens, collector_report):
        r = requests.post(
            f"{API}/closing-reports",
            json={"date": TODAY_ISO},
            headers=_h(tokens["field_collector"]),
            timeout=20,
        )
        assert r.status_code == 400, r.text
        assert "Already submitted" in r.json().get("detail", "")

    def test_branch_manager_cannot_submit(self, tokens):
        r = requests.post(
            f"{API}/closing-reports",
            json={"date": TODAY_ISO},
            headers=_h(tokens["branch_manager"]),
            timeout=20,
        )
        assert r.status_code == 403

    def test_unauth_returns_401(self):
        r = requests.post(f"{API}/closing-reports", json={"date": TODAY_ISO}, timeout=20)
        assert r.status_code in (401, 403)


# ============================================================
# 5) GET /closing-reports listing + FC scoping
# ============================================================
class TestListClosingReports:
    def test_admin_can_filter_by_type_and_date(self, tokens):
        r = requests.get(
            f"{API}/closing-reports?type=collector&date={TODAY_ISO}",
            headers=_h(tokens["admin"]),
            timeout=20,
        )
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        for it in items:
            assert it["type"] == "collector"
            assert it["date"] == TODAY_ISO

    def test_fc_sees_only_own_reports(self, tokens, fc_user):
        r = requests.get(f"{API}/closing-reports", headers=_h(tokens["field_collector"]), timeout=20)
        assert r.status_code == 200
        for it in r.json():
            assert it.get("submitted_by") == fc_user["id"], "FC saw a foreign report"


# ============================================================
# 6) Branch-rollup
# ============================================================
class TestBranchRollup:
    def test_empty_ids_returns_400(self, tokens):
        r = requests.post(
            f"{API}/closing-reports/branch-rollup",
            json={"collector_report_ids": [], "date": TODAY_ISO},
            headers=_h(tokens["branch_assistant"]),
            timeout=20,
        )
        assert r.status_code == 400

    def test_unknown_id_returns_400(self, tokens):
        r = requests.post(
            f"{API}/closing-reports/branch-rollup",
            json={"collector_report_ids": ["nonexistent-id-xyz"], "date": TODAY_ISO},
            headers=_h(tokens["branch_assistant"]),
            timeout=20,
        )
        assert r.status_code == 400

    def test_non_ba_cannot_submit_rollup(self, tokens):
        r = requests.post(
            f"{API}/closing-reports/branch-rollup",
            json={"collector_report_ids": ["any"], "date": TODAY_ISO},
            headers=_h(tokens["field_collector"]),
            timeout=20,
        )
        assert r.status_code == 403


# ============================================================
# 7) End-to-end happy path: collector -> rollup -> validate -> FTx flips
# ============================================================
class TestE2EClosingFlow:
    def test_full_flow_validates_linked_financial_txs(self, tokens, released_loan):
        """
        Use admin as a synthetic collector to keep test isolated from FC state
        across test re-runs. Collect a unique day via admin, submit admin
        collector close, BA rollup, AM validate, then assert linked FTx flipped.
        """
        loan_id = released_loan["loan_id"]
        # Pick a high day number unlikely to collide with prior runs (day 30)
        target_day = 30
        r = requests.post(
            f"{API}/payments/collect",
            json={"loan_id": loan_id, "day": target_day, "amount": 200, "notes": "CRTEST E2E day30"},
            headers=_h(tokens["admin"]),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        new_payment_id = r.json()["id"]

        # Verify the auto-revenue pending FTx exists for this payment
        r = requests.get(
            f"{API}/financial/transactions?status=pending&type=revenue",
            headers=_h(tokens["admin"]),
            timeout=20,
        )
        assert any(t.get("reference_id") == new_payment_id for t in r.json()), \
            "Pending revenue FTx for day-30 admin collect not found"

        # Find or create today's admin collector report
        lst = requests.get(
            f"{API}/closing-reports?type=collector&date={TODAY_ISO}",
            headers=_h(tokens["admin"]),
            timeout=20,
        ).json()
        adm_cr = next(
            (x for x in lst if x.get("submitted_by_role") == "admin" and x.get("status") == "pending"),
            None,
        )
        if adm_cr is None:
            r = requests.post(
                f"{API}/closing-reports",
                json={"date": TODAY_ISO, "notes": "CRTEST admin E2E"},
                headers=_h(tokens["admin"]),
                timeout=20,
            )
            if r.status_code == 400:
                pytest.skip("Admin already has a non-pending collector report today; cannot re-run E2E.")
            assert r.status_code == 200, r.text
            adm_cr = r.json()

        snapshot_payment_ids = adm_cr.get("payment_ids", [])
        assert new_payment_id in snapshot_payment_ids, \
            "Day-30 payment id missing from admin collector report snapshot"

        # BA rollup
        r = requests.post(
            f"{API}/closing-reports/branch-rollup",
            json={"collector_report_ids": [adm_cr["id"]], "date": TODAY_ISO, "notes": "CRTEST E2E rollup"},
            headers=_h(tokens["branch_assistant"]),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        branch = r.json()
        assert branch["type"] == "branch"
        assert branch["status"] == "submitted"
        assert adm_cr["id"] in branch["child_report_ids"]
        # totals aggregated and payment_ids carried over
        assert branch["totals"]["collected_amount"] >= 200
        assert new_payment_id in branch["payment_ids"]

        # Child collector report should now be "submitted" and linked
        lst2 = requests.get(
            f"{API}/closing-reports?type=collector&date={TODAY_ISO}",
            headers=_h(tokens["admin"]),
            timeout=20,
        ).json()
        child = next((x for x in lst2 if x["id"] == adm_cr["id"]), None)
        assert child is not None
        assert child["status"] == "submitted"
        assert child.get("parent_report_id") == branch["id"]

        # Re-rolling-up the same (now non-pending) cr should 400
        r = requests.post(
            f"{API}/closing-reports/branch-rollup",
            json={"collector_report_ids": [adm_cr["id"]], "date": TODAY_ISO},
            headers=_h(tokens["branch_assistant"]),
            timeout=20,
        )
        assert r.status_code == 400, r.text

        # Pre-validation: FTx for new_payment_id should be pending
        r = requests.get(
            f"{API}/financial/transactions?status=pending&type=revenue",
            headers=_h(tokens["admin"]),
            timeout=20,
        )
        pre = [t for t in r.json() if t.get("reference_id") == new_payment_id]
        assert pre and pre[0]["status"] == "pending", "Day-30 FTx should be pending pre-validation"

        # AM validates the branch rollup
        r = requests.post(
            f"{API}/closing-reports/{branch['id']}/validate",
            json={"decision": "validated", "notes": "CRTEST validated"},
            headers=_h(tokens["area_manager"]),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["status"] == "validated"
        assert v.get("validated_by")
        assert v.get("validated_at")

        # Child cascade
        lst3 = requests.get(
            f"{API}/closing-reports?type=collector&date={TODAY_ISO}",
            headers=_h(tokens["admin"]),
            timeout=20,
        ).json()
        child2 = next((x for x in lst3 if x["id"] == adm_cr["id"]), None)
        assert child2 is not None
        assert child2["status"] == "validated"

        # Day-30 FTx now validated
        r = requests.get(
            f"{API}/financial/transactions?status=validated&type=revenue",
            headers=_h(tokens["admin"]),
            timeout=20,
        )
        validated = [t for t in r.json() if t.get("reference_id") == new_payment_id]
        assert validated, "Day-30 FTx should be validated post-AM-validate"
        assert validated[0]["status"] == "validated"

        # And no longer pending
        r = requests.get(
            f"{API}/financial/transactions?status=pending&type=revenue",
            headers=_h(tokens["admin"]),
            timeout=20,
        )
        assert not any(t.get("reference_id") == new_payment_id for t in r.json())

        # Second validate -> 400
        r = requests.post(
            f"{API}/closing-reports/{branch['id']}/validate",
            json={"decision": "validated"},
            headers=_h(tokens["area_manager"]),
            timeout=20,
        )
        assert r.status_code == 400


# ============================================================
# 8) Rejected decision does NOT validate FTx
# ============================================================
class TestRejectDecision:
    def test_rejected_branch_does_not_flip_ftx(self, tokens, released_loan, fc_user):
        """
        Build a second FC + second branch report path by using ADMIN as a
        synthetic collector (admin role is allowed to POST /closing-reports).
        Admin collects on day 6, submits collector report (admin own), BA rolls
        up just that report, AM rejects, then assert pending FTx remains pending.
        """
        loan_id = released_loan["loan_id"]
        # Admin collects day 6 (will create a separate payment_id + auto-revenue tx)
        r = requests.post(
            f"{API}/payments/collect",
            json={"loan_id": loan_id, "day": 6, "amount": 200, "notes": "CRTEST admin-collect"},
            headers=_h(tokens["admin"]),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        admin_payment_id = r.json()["id"]

        # Admin submits a collector closing report for today (allowed since admin role)
        r = requests.post(
            f"{API}/closing-reports",
            json={"date": TODAY_ISO, "notes": "CRTEST admin-collector"},
            headers=_h(tokens["admin"]),
            timeout=20,
        )
        if r.status_code == 400:
            # Already submitted today by admin - fetch it
            lst = requests.get(
                f"{API}/closing-reports?type=collector&date={TODAY_ISO}",
                headers=_h(tokens["admin"]),
                timeout=20,
            ).json()
            adm_cr = next((x for x in lst if x.get("submitted_by_role") == "admin"), None)
            if adm_cr is None:
                pytest.skip("No admin-owned collector report could be located")
        else:
            assert r.status_code == 200, r.text
            adm_cr = r.json()

        if adm_cr["status"] != "pending":
            pytest.skip(f"Admin collector report not pending (status={adm_cr['status']}); skipping reject test")

        # BA rolls it up
        r = requests.post(
            f"{API}/closing-reports/branch-rollup",
            json={"collector_report_ids": [adm_cr["id"]], "date": TODAY_ISO},
            headers=_h(tokens["branch_assistant"]),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        branch = r.json()

        # AM rejects
        r = requests.post(
            f"{API}/closing-reports/{branch['id']}/validate",
            json={"decision": "rejected", "notes": "CRTEST reject"},
            headers=_h(tokens["area_manager"]),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "rejected"

        # Verify FTx for admin_payment_id still pending (if it was in snapshot)
        snapshot_ids = adm_cr.get("payment_ids", [])
        if admin_payment_id in snapshot_ids:
            r = requests.get(
                f"{API}/financial/transactions?limit=2000",
                headers=_h(tokens["admin"]),
                timeout=20,
            )
            txs = [t for t in r.json() if t.get("reference_id") == admin_payment_id]
            assert txs, "expected admin-payment FTx to exist"
            assert txs[0]["status"] == "pending", (
                f"Rejected closing should NOT validate FTx, got status={txs[0]['status']}"
            )


# ============================================================
# 9) GET /payments/history-by-client
# ============================================================
class TestHistoryByClient:
    def test_history_shape_for_released_loan(self, tokens, released_loan):
        r = requests.get(
            f"{API}/payments/history-by-client",
            headers=_h(tokens["field_collector"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        ours = next((x for x in items if x["loan_id"] == released_loan["loan_id"]), None)
        assert ours is not None, "Released CRTEST loan missing from history-by-client"
        for k in ["loan_id", "control_no", "borrower_name", "release_date", "totals", "days"]:
            assert k in ours
        for k in ["paid", "outstanding", "pending", "total", "progress"]:
            assert k in ours["totals"]
        # 60 terms approved -> days length 60
        assert len(ours["days"]) == 60, f"Expected 60 days, got {len(ours['days'])}"
        # progress > 0 since we collected at least 1
        assert ours["totals"]["paid"] >= 200
        assert ours["totals"]["progress"] > 0

    def test_history_unauth(self):
        r = requests.get(f"{API}/payments/history-by-client", timeout=20)
        assert r.status_code in (401, 403)
