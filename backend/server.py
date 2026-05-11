from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any, Dict

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr


# ---------- DB ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


# ---------- Auth helpers ----------
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 12


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        "type": "access",
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*roles: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles and user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return dep


# ---------- Models ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str


class LoanApplicationCreate(BaseModel):
    data: Dict[str, Any] = Field(default_factory=dict)
    status: str = "Draft"


class LoanApplicationUpdate(BaseModel):
    data: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


# ---------- Seed ----------
TEST_USERS = [
    {"email": "admin.system@gmail.com", "password": "Systemdev0118", "name": "System Admin", "role": "admin"},
    {"email": "fc.lucena@gmail.com", "password": "FC@lucena12345", "name": "Field Collector - Lucena", "role": "field_collector"},
    {"email": "assitant.lucena@gmail.com", "password": "Assistant@lucena12345", "name": "Branch Assistant - Lucena", "role": "branch_assistant"},
    {"email": "bm.lucena@gmail.com", "password": "Bm@lucena12345", "name": "Branch Manager - Lucena", "role": "branch_manager"},
    {"email": "v.lucena@gmail.com", "password": "V@lucena12345", "name": "Verifier - Lucena", "role": "verifier"},
    {"email": "am.lucena@gmail.com", "password": "Am@lucena12345", "name": "Area Manager - Lucena", "role": "area_manager"},
    {"email": "r.lucena@gmail.com", "password": "R@lucena12345", "name": "Releasing Officer - Lucena", "role": "releasing_officer"},
]


async def seed_users():
    await db.users.create_index("email", unique=True)
    for u in TEST_USERS:
        existing = await db.users.find_one({"email": u["email"]})
        if existing is None:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": u["email"],
                "password_hash": hash_password(u["password"]),
                "name": u["name"],
                "role": u["role"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        elif not verify_password(u["password"], existing["password_hash"]):
            await db.users.update_one(
                {"email": u["email"]},
                {"$set": {"password_hash": hash_password(u["password"]), "name": u["name"], "role": u["role"]}},
            )


# ---------- App ----------
app = FastAPI()
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "EFCIS LMS API"}


# ---------- Auth routes ----------
@api_router.post("/auth/login")
async def login(body: LoginRequest):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"], user["role"])
    return {
        "token": token,
        "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]},
    }


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"], "avatar_data_url": user.get("avatar_data_url")}


@api_router.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}


# ---------- Settings ----------
@api_router.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        return {"id": "global", "logo_data_url": None, "system_name": "EFCIS LMS"}
    return s


@api_router.put("/settings")
async def update_settings(payload: Dict[str, Any], user: dict = Depends(require_roles("admin"))):
    payload["id"] = "global"
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one({"id": "global"}, {"$set": payload}, upsert=True)
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    return s


# ---------- Control number generation ----------
async def generate_control_no() -> str:
    now = datetime.now(timezone.utc)
    prefix = f"EFCIS-{now.strftime('%Y%m')}-"
    count = await db.loan_applications.count_documents({"control_no": {"$regex": f"^{prefix}"}})
    return f"{prefix}{(count + 1):05d}"


# ---------- Loan Applications ----------
@api_router.get("/loan-applications")
async def list_applications(user: dict = Depends(get_current_user)):
    query: Dict[str, Any] = {}
    if user["role"] == "field_collector":
        query["created_by"] = user["id"]
    items = await db.loan_applications.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return items


@api_router.get("/loan-applications/{app_id}")
async def get_application(app_id: str, user: dict = Depends(get_current_user)):
    item = await db.loan_applications.find_one({"id": app_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item


@api_router.post("/loan-applications")
async def create_application(body: LoanApplicationCreate, user: dict = Depends(require_roles("field_collector"))):
    now_iso = datetime.now(timezone.utc).isoformat()
    control_no = await generate_control_no()
    data = body.data or {}
    doc = {
        "id": str(uuid.uuid4()),
        "control_no": control_no,
        "status": body.status or "Draft",
        "data": data,
        "created_by": user["id"],
        "created_by_name": user["name"],
        "collector_name": data.get("collector_name") or user["name"],
        "first_name": data.get("first_name", ""),
        "middle_name": data.get("middle_name", ""),
        "surname": data.get("surname", ""),
        "suffix": data.get("suffix", ""),
        "contact_no": data.get("contact_no", ""),
        "present_address": data.get("present_address", ""),
        "created_at": now_iso,
        "updated_at": now_iso,
        "step_history": [{"step": 1, "by": user["id"], "by_name": user["name"], "role": user["role"], "at": now_iso, "status": body.status or "Draft"}],
    }
    await db.loan_applications.insert_one(doc)
    doc.pop("_id", None)
    await _log_activity(user, "loan.create", "loan_application", doc["id"], {"control_no": control_no, "status": doc["status"]})
    return doc


@api_router.put("/loan-applications/{app_id}")
async def update_application(app_id: str, body: LoanApplicationUpdate, user: dict = Depends(get_current_user)):
    item = await db.loan_applications.find_one({"id": app_id})
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    update: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    new_data = item.get("data", {})
    if body.data:
        new_data = {**new_data, **body.data}
        update["data"] = new_data
        # mirror common fields for table list
        for k in ["first_name", "middle_name", "surname", "suffix", "contact_no", "present_address", "collector_name"]:
            if k in body.data:
                update[k] = body.data[k]
    if body.status:
        update["status"] = body.status
    history = item.get("step_history", [])
    history.append({
        "by": user["id"], "by_name": user["name"], "role": user["role"],
        "at": update["updated_at"], "status": body.status or item.get("status"),
    })
    update["step_history"] = history
    await db.loan_applications.update_one({"id": app_id}, {"$set": update})
    updated = await db.loan_applications.find_one({"id": app_id}, {"_id": 0})
    if body.status:
        await _log_activity(user, "loan.status_change", "loan_application", app_id, {"control_no": item.get("control_no"), "new_status": body.status})
    return updated


@api_router.post("/loan-applications/{app_id}/reject")
async def reject_application(app_id: str, payload: Dict[str, Any] = None, user: dict = Depends(require_roles("area_manager"))):
    item = await db.loan_applications.find_one({"id": app_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    item["status"] = "Rejected"
    item["rejected_at"] = datetime.now(timezone.utc).isoformat()
    item["rejected_by"] = user["name"]
    item["rejection_reason"] = (payload or {}).get("reason", "")
    await db.loan_management.insert_one(item)
    await db.loan_applications.delete_one({"id": app_id})
    item.pop("_id", None)
    return {"ok": True}


@api_router.post("/loan-applications/{app_id}/release")
async def release_application(app_id: str, payload: Dict[str, Any] = None, user: dict = Depends(require_roles("releasing_officer"))):
    item = await db.loan_applications.find_one({"id": app_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    data = item.get("data", {})
    if payload:
        data = {**data, **payload}
    item["data"] = data
    item["status"] = "Released"
    item["loan_status"] = "Ongoing"
    item["released_at"] = datetime.now(timezone.utc).isoformat()
    item["released_by"] = user["name"]
    await db.loan_management.insert_one(item)
    await db.loan_applications.delete_one({"id": app_id})
    item.pop("_id", None)
    return {"ok": True}


@api_router.get("/loan-management")
async def list_loan_management(user: dict = Depends(get_current_user)):
    items = await db.loan_management.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return items


@api_router.get("/loan-management/{app_id}")
async def get_loan_management(app_id: str, user: dict = Depends(get_current_user)):
    item = await db.loan_management.find_one({"id": app_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item


# ---------- Payments ----------
def _calc_daily(approved: float, terms: int) -> float:
    A = float(approved or 0)
    t = int(terms or 0)
    rate = 0.20 if t == 60 else 0.22 if t == 80 else 0.0
    if t <= 0:
        return 0.0
    return (A + A * rate) / t


def _build_schedule(loan: Dict[str, Any]) -> List[Dict[str, Any]]:
    data = loan.get("data", {}) or {}
    release_date_str = data.get("release_date")
    terms = int(data.get("approved_terms") or 0)
    if not release_date_str or terms <= 0:
        return []
    try:
        rd = datetime.fromisoformat(release_date_str)
    except Exception:
        try:
            rd = datetime.strptime(release_date_str, "%Y-%m-%d")
        except Exception:
            return []
    daily = _calc_daily(data.get("approved_amount"), terms)
    rows = []
    for i in range(1, terms + 1):
        due = rd + timedelta(days=i)
        rows.append({
            "loan_id": loan["id"],
            "control_no": loan.get("control_no"),
            "borrower_name": " ".join(filter(None, [loan.get("first_name"), loan.get("middle_name"), loan.get("surname"), loan.get("suffix")])).strip(),
            "contact_no": loan.get("contact_no"),
            "address": loan.get("present_address"),
            "day": i,
            "due_date": due.date().isoformat(),
            "amount": round(daily, 2),
        })
    return rows


@api_router.get("/payments/daily")
async def payments_daily(date: Optional[str] = None, include_outstanding: bool = True, user: dict = Depends(get_current_user)):
    if date:
        try:
            target_date = datetime.fromisoformat(date).date()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        target_date = datetime.now(timezone.utc).date()
    target_iso = target_date.isoformat()
    # Collector exclusivity: FC sees only loans they originally created
    loan_query: Dict[str, Any] = {"status": "Released"}
    if user["role"] == "field_collector":
        loan_query["created_by"] = user["id"]
    released = await db.loan_management.find(loan_query, {"_id": 0}).to_list(2000)
    pay_records = await db.payments.find({}, {"_id": 0}).to_list(20000)
    pay_map = {(p["loan_id"], p["day"]): p for p in pay_records}

    out = []
    for loan in released:
        for row in _build_schedule(loan):
            rec = pay_map.get((row["loan_id"], row["day"]))
            row["status"] = (rec.get("status") if rec else "pending")
            row["receipt_no"] = rec.get("receipt_no") if rec else None
            row["action_at"] = rec.get("action_at") if rec else None
            row["action_by_name"] = rec.get("action_by_name") if rec else None
            row["notes"] = rec.get("notes") if rec else None
            include_row = (row["due_date"] == target_iso)
            if include_outstanding and not include_row and row["due_date"] < target_iso and row["status"] != "paid":
                include_row = True
            if include_row:
                out.append(row)
    out.sort(key=lambda r: (r["due_date"], r["control_no"], r["day"]))
    return out


@api_router.get("/payments/loan/{loan_id}")
async def payments_for_loan(loan_id: str, user: dict = Depends(get_current_user)):
    loan = await db.loan_management.find_one({"id": loan_id}, {"_id": 0})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    pay_records = await db.payments.find({"loan_id": loan_id}, {"_id": 0}).to_list(2000)
    pay_map = {p["day"]: p for p in pay_records}
    rows = _build_schedule(loan)
    for r in rows:
        rec = pay_map.get(r["day"])
        r["status"] = rec.get("status") if rec else "pending"
        r["receipt_no"] = rec.get("receipt_no") if rec else None
        r["action_at"] = rec.get("action_at") if rec else None
        r["action_by_name"] = rec.get("action_by_name") if rec else None
        r["notes"] = rec.get("notes") if rec else None
    return rows


async def _next_receipt_no() -> str:
    now = datetime.now(timezone.utc)
    prefix = f"OR-{now.strftime('%Y%m%d')}-"
    count = await db.payments.count_documents({"receipt_no": {"$regex": f"^{prefix}"}})
    return f"{prefix}{(count + 1):04d}"


@api_router.post("/payments/collect")
async def payments_collect(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    loan_id = payload.get("loan_id")
    day_raw = payload.get("day")
    if not loan_id or day_raw is None:
        raise HTTPException(status_code=400, detail="loan_id and day required")
    try:
        day = int(day_raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="day must be an integer")
    amount = float(payload.get("amount") or 0)
    existing = await db.payments.find_one({"loan_id": loan_id, "day": day})
    receipt_no = await _next_receipt_no()
    record = {
        "id": str(uuid.uuid4()),
        "loan_id": loan_id,
        "day": day,
        "amount": amount,
        "status": "paid",
        "receipt_no": receipt_no,
        "action_at": datetime.now(timezone.utc).isoformat(),
        "action_by": user["id"],
        "action_by_name": user["name"],
        "notes": payload.get("notes", ""),
    }
    if existing:
        await db.payments.update_one({"loan_id": loan_id, "day": day}, {"$set": record})
    else:
        await db.payments.insert_one(record)
    record.pop("_id", None)
    await _log_activity(user, "payment.collect", "payment", record["id"], {"loan_id": loan_id, "day": day, "amount": amount, "receipt_no": receipt_no})
    return record


@api_router.post("/payments/pass")
async def payments_pass(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    loan_id = payload.get("loan_id")
    day_raw = payload.get("day")
    if not loan_id or day_raw is None:
        raise HTTPException(status_code=400, detail="loan_id and day required")
    try:
        day = int(day_raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="day must be an integer")
    existing = await db.payments.find_one({"loan_id": loan_id, "day": day})
    if existing and existing.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Already paid")
    record = {
        "id": str(uuid.uuid4()),
        "loan_id": loan_id,
        "day": day,
        "amount": float(payload.get("amount") or 0),
        "status": "outstanding",
        "action_at": datetime.now(timezone.utc).isoformat(),
        "action_by": user["id"],
        "action_by_name": user["name"],
        "notes": payload.get("reason", ""),
    }
    if existing:
        await db.payments.update_one({"loan_id": loan_id, "day": day}, {"$set": record})
    else:
        await db.payments.insert_one(record)
    record.pop("_id", None)
    return record


# ---------- User Management (Admin) ----------
@api_router.get("/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    items = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(2000)
    return items


@api_router.post("/users")
async def create_user(payload: Dict[str, Any], user: dict = Depends(require_roles("admin"))):
    email = (payload.get("email") or "").lower().strip()
    password = payload.get("password") or ""
    name = (payload.get("name") or "").strip()
    role = (payload.get("role") or "").strip()
    if not email or not password or not name or not role:
        raise HTTPException(status_code=400, detail="name, email, password, role required")
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already in use")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(password),
        "name": name,
        "role": role,
        "avatar_data_url": payload.get("avatar_data_url"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    await _log_activity(user, "user.create", "user", doc["id"], {"email": email, "role": role})
    return doc


@api_router.put("/users/{user_id}")
async def update_user(user_id: str, payload: Dict[str, Any], user: dict = Depends(require_roles("admin"))):
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    update: Dict[str, Any] = {}
    if "name" in payload: update["name"] = payload["name"]
    if "role" in payload: update["role"] = payload["role"]
    if "avatar_data_url" in payload: update["avatar_data_url"] = payload["avatar_data_url"]
    if "email" in payload:
        new_email = payload["email"].lower().strip()
        if new_email != existing["email"]:
            conflict = await db.users.find_one({"email": new_email})
            if conflict:
                raise HTTPException(status_code=409, detail="Email already in use")
            update["email"] = new_email
    if payload.get("password"):
        update["password_hash"] = hash_password(payload["password"])
    if update:
        await db.users.update_one({"id": user_id}, {"$set": update})
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    await _log_activity(user, "user.update", "user", user_id, {"fields": list(update.keys())})
    return updated


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_roles("admin"))):
    if user["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    res = await db.users.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await _log_activity(user, "user.delete", "user", user_id, {})
    return {"ok": True}


# ---------- Attendance ----------
@api_router.post("/attendance/check-in")
async def attendance_check_in(payload: Optional[Dict[str, Any]] = None, user: dict = Depends(get_current_user)):
    payload = payload or {}
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    existing = await db.attendance.find_one({"user_id": user["id"], "date": today})
    if existing and existing.get("check_in"):
        raise HTTPException(status_code=400, detail="Already checked in today")
    record = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_role": user["role"],
        "date": today,
        "check_in": now.isoformat(),
        "check_out": None,
        "location_in": payload.get("location"),
        "location_out": None,
        "notes": payload.get("notes", ""),
        "status": "present",
        "hours": 0,
    }
    if existing:
        await db.attendance.update_one({"id": existing["id"]}, {"$set": record})
    else:
        await db.attendance.insert_one(record)
    record.pop("_id", None)
    await _log_activity(user, "attendance.check_in", "attendance", record["id"], {"date": today})
    return record


@api_router.post("/attendance/check-out")
async def attendance_check_out(payload: Optional[Dict[str, Any]] = None, user: dict = Depends(get_current_user)):
    payload = payload or {}
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    existing = await db.attendance.find_one({"user_id": user["id"], "date": today})
    if not existing or not existing.get("check_in"):
        raise HTTPException(status_code=400, detail="Not checked in")
    if existing.get("check_out"):
        raise HTTPException(status_code=400, detail="Already checked out")
    check_in_dt = datetime.fromisoformat(existing["check_in"])
    hours = (now - check_in_dt).total_seconds() / 3600.0
    await db.attendance.update_one(
        {"id": existing["id"]},
        {"$set": {"check_out": now.isoformat(), "location_out": payload.get("location"), "hours": round(hours, 2)}},
    )
    rec = await db.attendance.find_one({"id": existing["id"]}, {"_id": 0})
    await _log_activity(user, "attendance.check_out", "attendance", existing["id"], {"date": today, "hours": round(hours, 2)})
    return rec


@api_router.get("/attendance/me")
async def attendance_me(user: dict = Depends(get_current_user)):
    items = await db.attendance.find({"user_id": user["id"]}, {"_id": 0}).sort("date", -1).to_list(500)
    return items


@api_router.get("/attendance/today")
async def attendance_today(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    rec = await db.attendance.find_one({"user_id": user["id"], "date": today}, {"_id": 0})
    return rec or {}


@api_router.get("/attendance")
async def attendance_all(user: dict = Depends(require_roles("admin")), from_date: Optional[str] = None, to_date: Optional[str] = None):
    query: Dict[str, Any] = {}
    if from_date or to_date:
        date_q: Dict[str, Any] = {}
        if from_date: date_q["$gte"] = from_date
        if to_date: date_q["$lte"] = to_date
        query["date"] = date_q
    items = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(2000)
    return items


@api_router.put("/attendance/{att_id}")
async def attendance_update(att_id: str, payload: Dict[str, Any], user: dict = Depends(require_roles("admin"))):
    update: Dict[str, Any] = {}
    for k in ("status", "notes", "hours"):
        if k in payload: update[k] = payload[k]
    if update:
        res = await db.attendance.update_one({"id": att_id}, {"$set": update})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
    item = await db.attendance.find_one({"id": att_id}, {"_id": 0})
    return item


@api_router.get("/attendance/payroll")
async def attendance_payroll(from_date: str, to_date: str, daily_rate: float = 500.0, user: dict = Depends(require_roles("admin"))):
    records = await db.attendance.find({"date": {"$gte": from_date, "$lte": to_date}}, {"_id": 0}).to_list(5000)
    summary: Dict[str, Dict[str, Any]] = {}
    for r in records:
        uid = r["user_id"]
        if uid not in summary:
            summary[uid] = {
                "user_id": uid,
                "user_name": r["user_name"],
                "user_role": r.get("user_role"),
                "days_present": 0,
                "days_absent": 0,
                "days_late": 0,
                "total_hours": 0.0,
            }
        st = (r.get("status") or "present").lower()
        if st == "absent": summary[uid]["days_absent"] += 1
        elif st == "late": summary[uid]["days_late"] += 1; summary[uid]["total_hours"] += r.get("hours") or 0
        else: summary[uid]["days_present"] += 1; summary[uid]["total_hours"] += r.get("hours") or 0
    out = []
    for s in summary.values():
        eligible = s["days_present"] + s["days_late"]
        s["gross_pay"] = round(eligible * daily_rate, 2)
        s["daily_rate"] = daily_rate
        s["total_hours"] = round(s["total_hours"], 2)
        out.append(s)
    out.sort(key=lambda x: x["user_name"])
    return {"from": from_date, "to": to_date, "daily_rate": daily_rate, "items": out}


# ---------- Activity Log ----------
async def _log_activity(actor: dict, action: str, target_type: str = None, target_id: str = None, details: Dict[str, Any] = None):
    try:
        await db.activity_logs.insert_one({
            "id": str(uuid.uuid4()),
            "actor_id": actor.get("id"),
            "actor_name": actor.get("name"),
            "actor_role": actor.get("role"),
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "details": details or {},
            "at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.warning(f"activity log failed: {e}")


@api_router.get("/activity-logs")
async def list_activity_logs(
    user: dict = Depends(require_roles("admin")),
    limit: int = 500,
    actor_id: Optional[str] = None,
    action: Optional[str] = None,
):
    q: Dict[str, Any] = {}
    if actor_id: q["actor_id"] = actor_id
    if action: q["action"] = action
    items = await db.activity_logs.find(q, {"_id": 0}).sort("at", -1).to_list(max(1, min(2000, limit)))
    return items


# ---------- Financial Management ----------
# Roles: BA records transactions (pending); AM validates; Admin can deposit/withdraw between cash & bank.
ALLOWED_TX_TYPES = {"revenue", "expense", "disbursement"}


def _delta_for_tx(tx_type: str, amount: float, account: str):
    """Returns (cash_delta, bank_delta) for an in/out flow on a single account."""
    a = float(amount or 0)
    if tx_type == "revenue":
        return (a, 0.0) if account == "cash" else (0.0, a)
    # expense, disbursement => outflow
    return (-a, 0.0) if account == "cash" else (0.0, -a)


@api_router.get("/financial/balances")
async def financial_balances(user: dict = Depends(require_roles("admin", "area_manager", "branch_assistant"))):
    cursor = db.financial_transactions.find({"status": "validated"}, {"_id": 0})
    cash = 0.0
    bank = 0.0
    async for t in cursor:
        cash += float(t.get("cash_delta") or 0)
        bank += float(t.get("bank_delta") or 0)
    return {"cash": round(cash, 2), "bank": round(bank, 2), "total": round(cash + bank, 2)}


@api_router.get("/financial/transactions")
async def list_financial_transactions(
    user: dict = Depends(require_roles("admin", "area_manager", "branch_assistant")),
    status: Optional[str] = None,
    type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    q: Dict[str, Any] = {}
    if status: q["status"] = status
    if type: q["type"] = type
    if from_date or to_date:
        dr: Dict[str, Any] = {}
        if from_date: dr["$gte"] = from_date
        if to_date: dr["$lte"] = to_date + "T23:59:59"
        q["recorded_at"] = dr
    items = await db.financial_transactions.find(q, {"_id": 0}).sort("recorded_at", -1).to_list(2000)
    return items


@api_router.post("/financial/transactions")
async def create_financial_transaction(
    payload: Dict[str, Any],
    user: dict = Depends(require_roles("admin", "branch_assistant")),
):
    tx_type = (payload.get("type") or "").lower()
    if tx_type not in ALLOWED_TX_TYPES:
        raise HTTPException(status_code=400, detail=f"type must be one of {sorted(ALLOWED_TX_TYPES)}")
    account = (payload.get("account") or "cash").lower()
    if account not in {"cash", "bank"}:
        raise HTTPException(status_code=400, detail="account must be 'cash' or 'bank'")
    try:
        amount = float(payload.get("amount") or 0)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="amount must be a number")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be > 0")
    cash_delta, bank_delta = _delta_for_tx(tx_type, amount, account)
    # Admin-recorded transactions are auto-validated
    auto_validate = user["role"] == "admin"
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "type": tx_type,
        "account": account,
        "amount": amount,
        "cash_delta": cash_delta,
        "bank_delta": bank_delta,
        "category": payload.get("category", ""),
        "description": payload.get("description", ""),
        "reference_id": payload.get("reference_id"),
        "recorded_by": user["id"],
        "recorded_by_name": user["name"],
        "recorded_by_role": user["role"],
        "recorded_at": now_iso,
        "status": "validated" if auto_validate else "pending",
        "validated_by": user["id"] if auto_validate else None,
        "validated_by_name": user["name"] if auto_validate else None,
        "validated_at": now_iso if auto_validate else None,
    }
    await db.financial_transactions.insert_one(doc)
    doc.pop("_id", None)
    await _log_activity(user, "financial.tx_create", "financial_transaction", doc["id"], {"type": tx_type, "amount": amount, "account": account, "status": doc["status"]})
    return doc


@api_router.post("/financial/transactions/{tx_id}/validate")
async def validate_financial_transaction(tx_id: str, payload: Optional[Dict[str, Any]] = None, user: dict = Depends(require_roles("admin", "area_manager"))):
    tx = await db.financial_transactions.find_one({"id": tx_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.get("status") == "validated":
        raise HTTPException(status_code=400, detail="Already validated")
    decision = ((payload or {}).get("decision") or "validated").lower()
    if decision not in {"validated", "rejected"}:
        raise HTTPException(status_code=400, detail="decision must be 'validated' or 'rejected'")
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.financial_transactions.update_one(
        {"id": tx_id},
        {"$set": {
            "status": decision,
            "validated_by": user["id"],
            "validated_by_name": user["name"],
            "validated_at": now_iso,
            "validation_notes": (payload or {}).get("notes", ""),
        }},
    )
    updated = await db.financial_transactions.find_one({"id": tx_id}, {"_id": 0})
    await _log_activity(user, f"financial.tx_{decision}", "financial_transaction", tx_id, {"type": tx.get("type"), "amount": tx.get("amount")})
    return updated


@api_router.post("/financial/transfer")
async def financial_transfer(payload: Dict[str, Any], user: dict = Depends(require_roles("admin"))):
    """Admin moves money between cash and bank. Records one validated transaction."""
    src = (payload.get("from") or "").lower()
    dst = (payload.get("to") or "").lower()
    if {src, dst} != {"cash", "bank"} or src == dst:
        raise HTTPException(status_code=400, detail="from/to must be one of cash/bank and different")
    try:
        amount = float(payload.get("amount") or 0)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="amount must be a number")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be > 0")
    cash_delta = (-amount if src == "cash" else amount)
    bank_delta = (-amount if src == "bank" else amount)
    tx_type = "deposit" if (src == "cash" and dst == "bank") else "withdrawal"
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "type": tx_type,
        "account": dst,
        "amount": amount,
        "cash_delta": cash_delta,
        "bank_delta": bank_delta,
        "category": "transfer",
        "description": payload.get("description", f"{tx_type.title()} {amount:.2f} from {src} to {dst}"),
        "recorded_by": user["id"],
        "recorded_by_name": user["name"],
        "recorded_by_role": user["role"],
        "recorded_at": now_iso,
        "status": "validated",
        "validated_by": user["id"],
        "validated_by_name": user["name"],
        "validated_at": now_iso,
    }
    await db.financial_transactions.insert_one(doc)
    doc.pop("_id", None)
    await _log_activity(user, f"financial.{tx_type}", "financial_transaction", doc["id"], {"amount": amount, "from": src, "to": dst})
    return doc


# ---------- Mount ----------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_event():
    await seed_users()
    logger.info("EFCIS LMS users seeded.")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
