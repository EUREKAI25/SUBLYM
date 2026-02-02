from fastapi import APIRouter, HTTPException
from ..core.auth import get_current_user
from ..db.memory import DB

router = APIRouter(prefix="/runs")

@router.get("/{trace_id}")
def get_run(trace_id: str, authorization: str | None = None):
    _ = get_current_user(authorization)
    r = DB.runs.get(trace_id)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "traceId": r.trace_id,
        "status": r.status,
        "progress": r.progress,
        "currentStep": r.current_step,
        "estimatedRemaining": r.estimated_remaining,
        "createdAt": r.created_at,
    }

@router.get("/{trace_id}/video")
def get_video(trace_id: str, authorization: str | None = None):
    user = get_current_user(authorization)
    user_id = user["id"]
    r = DB.runs.get(trace_id)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    if r.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if r.status != "completed" or not r.video_path:
        raise HTTPException(status_code=422, detail={"error": True, "code": "NOT_READY", "message": "Video not ready"})
    return {"videoUrl": r.video_path, "duration": None, "resolution": "720p", "createdAt": r.created_at}
