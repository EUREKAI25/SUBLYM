from fastapi import APIRouter
from ..models.schemas import AuthRegisterIn, MagicLinkIn, VerifyIn
from ..core.auth import create_access_token
from ..db.memory import gen_id

router = APIRouter(prefix="/auth")

@router.post("/register")
def register(_: AuthRegisterIn):
    return {"success": True, "message": "Magic link sent to email"}

@router.post("/magic-link")
def magic_link(_: MagicLinkIn):
    return {"success": True, "message": "Magic link sent"}

@router.post("/verify")
def verify(_: VerifyIn):
    user_id = gen_id("usr")
    token = create_access_token(user_id=user_id, email="user@example.com")
    return {
        "success": True,
        "accessToken": token,
        "user": {"id": user_id, "email": "user@example.com", "subscriptionLevel": 1, "freeGenerations": 3},
    }

@router.get("/me")
def me():
    return {"error": True, "code": "NOT_IMPLEMENTED", "message": "Use JWT and /auth/verify in MVP"}
