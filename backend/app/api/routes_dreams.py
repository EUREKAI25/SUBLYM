from fastapi import APIRouter, HTTPException
from ..core.auth import get_current_user
from ..db.memory import DB, Dream, Run, gen_id
from ..models.schemas import DreamCreateIn, DreamUpdateIn, GenerateIn
from ..services.storage import user_dream_dir
from ..services.pipeline import run_pipeline_dry
import threading

router = APIRouter(prefix="/dreams")

@router.post("", status_code=201)
def create_dream(payload: DreamCreateIn, authorization: str | None = None):
    user = get_current_user(authorization)
    user_id = user["id"]
    did = gen_id("drm")
    dream = Dream(
        id=did,
        user_id=user_id,
        description=payload.description,
        reject=payload.reject,
        style=payload.style,
        photo_ids=payload.photoIds,
        decor_photo_ids=payload.decorPhotoIds,
        status="draft",
    )
    DB.dreams[did] = dream
    return {"success": True, "dream": {"id": did, "description": dream.description, "reject": dream.reject, "style": dream.style, "status": dream.status, "createdAt": dream.created_at}}

@router.get("")
def list_dreams(authorization: str | None = None):
    user = get_current_user(authorization)
    user_id = user["id"]
    dreams = [d for d in DB.dreams.values() if d.user_id == user_id]
    return {"dreams": [{"id": d.id, "description": d.description, "status": d.status, "lastRunId": d.last_run_id, "createdAt": d.created_at} for d in dreams]}

@router.get("/{dream_id}")
def get_dream(dream_id: str, authorization: str | None = None):
    user = get_current_user(authorization)
    user_id = user["id"]
    d = DB.dreams.get(dream_id)
    if not d or d.user_id != user_id:
        raise HTTPException(status_code=404, detail="Not found")
    runs = [r for r in DB.runs.values() if r.dream_id == dream_id and r.user_id == user_id]
    return {
        "id": d.id,
        "description": d.description,
        "reject": d.reject,
        "style": d.style,
        "status": d.status,
        "photos": d.photo_ids,
        "runs": [{"id": r.id, "traceId": r.trace_id, "status": r.status, "videoPath": r.video_path, "createdAt": r.created_at} for r in runs],
        "createdAt": d.created_at,
    }

@router.put("/{dream_id}")
def update_dream(dream_id: str, payload: DreamUpdateIn, authorization: str | None = None):
    user = get_current_user(authorization)
    user_id = user["id"]
    d = DB.dreams.get(dream_id)
    if not d or d.user_id != user_id:
        raise HTTPException(status_code=404, detail="Not found")
    if payload.description is not None:
        d.description = payload.description
    if payload.reject is not None:
        d.reject = payload.reject
    if payload.style is not None:
        d.style = payload.style
    return {"success": True, "dream": {"id": d.id, "description": d.description, "reject": d.reject, "style": d.style, "status": d.status, "createdAt": d.created_at}}

@router.delete("/{dream_id}")
def delete_dream(dream_id: str, authorization: str | None = None):
    user = get_current_user(authorization)
    user_id = user["id"]
    d = DB.dreams.get(dream_id)
    if not d or d.user_id != user_id:
        raise HTTPException(status_code=404, detail="Not found")
    del DB.dreams[dream_id]
    return {"success": True}

def _background_run(trace_id: str, user_id: str, dream_id: str, dream_text: str, style: str):
    run = DB.runs[trace_id]
    try:
        run.status = "analyzing"; run.progress = 5; run.current_step = "Preparing plan"
        user_dir = user_dream_dir(user_id, dream_id)
        nb_scenes = 3
        scene_duration = 6
        mode = "chain"
        run.status = "scenario"; run.progress = 15; run.current_step = "Planning scenes"
        res = run_pipeline_dry(user_dir=user_dir, dream_id=dream_id, dream=dream_text, style=style, mode=mode, nb_scenes=nb_scenes, scene_duration=scene_duration)
        run.status = "generating"; run.progress = 70; run.current_step = "Generating videos"
        run.status = "assembling"; run.progress = 90; run.current_step = "Assembling final"
        run.status = "finalizing"; run.progress = 98; run.current_step = "Finalizing"
        run.video_path = res["final_path"]
        run.manifest_path = res["manifest_path"]
        run.status = "completed"; run.progress = 100; run.current_step = "Completed"
        DB.dreams[dream_id].status = "completed"
        DB.dreams[dream_id].last_run_id = trace_id
    except Exception as e:
        run.status = "failed"; run.error_message = str(e); run.current_step = "Failed"; run.progress = 100

@router.post("/{dream_id}/generate", status_code=202)
def generate(dream_id: str, _: GenerateIn, authorization: str | None = None):
    user = get_current_user(authorization)
    user_id = user["id"]
    d = DB.dreams.get(dream_id)
    if not d or d.user_id != user_id:
        raise HTTPException(status_code=404, detail="Not found")

    if d.photo_ids:
        for pid in d.photo_ids:
            if pid not in DB.photos or DB.photos[pid].user_id != user_id:
                raise HTTPException(status_code=404, detail=f"Photo not found: {pid}")
            if not DB.photos[pid].verified:
                raise HTTPException(status_code=422, detail={"error": True, "code": "PHOTOS_NOT_VERIFIED", "message": "Photos must be verified before generation"})

    run_id = gen_id("run")
    trace_id = gen_id("trc")
    run = Run(id=run_id, trace_id=trace_id, user_id=user_id, dream_id=dream_id, status="queued", progress=0, current_step="Queued", estimated_remaining=180)
    DB.runs[trace_id] = run

    th = threading.Thread(target=_background_run, args=(trace_id, user_id, dream_id, d.description, d.style), daemon=True)
    th.start()

    return {"success": True, "run": {"id": run_id, "traceId": trace_id, "status": "queued", "estimatedDuration": 180}}
