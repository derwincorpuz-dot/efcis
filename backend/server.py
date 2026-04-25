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
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}


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
