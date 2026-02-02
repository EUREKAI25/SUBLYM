from fastapi import Header, HTTPException
import jwt
from .settings import settings

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")

def get_current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"id": payload.get("sub"), "email": payload.get("email")}
