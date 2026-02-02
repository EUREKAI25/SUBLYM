from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List
import os
from ..core.auth import get_current_user
from ..db.memory import DB, Photo, gen_id
from ..services.storage import save_upload_bytes, delete_file
from ..models.schemas import PhotoVerifyIn
from ..services.identity import verify_photos_against_reference

router = APIRouter(prefix="/photos")

@router.post("/upload", status_code=201)
async def upload_photos(
    photos: List[UploadFile] = File(...),
    source: str = Form(...),
    authorization: str | None = None,
):
    user = get_current_user(authorization)
    user_id = user["id"]

    if source not in ("webcam", "upload"):
        raise HTTPException(status_code=400, detail="source must be webcam|upload")

    if source == "upload":
        has_ref = any(p.user_id == user_id and p.is_reference and p.source == "webcam" for p in DB.photos.values())
        if not has_ref:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": True,
                    "code": "MISSING_WEBCAM_REFERENCE",
                    "message": "Au moins une photo webcam de référence est requise avant d'uploader des photos",
                },
            )

    created = []
    for idx, up in enumerate(photos):
        pid = gen_id("pho")
        ext = os.path.splitext(up.filename or "")[1] or ".jpg"
        filename = f"{pid}{ext}"
        content = await up.read()
        path = save_upload_bytes(user_id, filename, content)

        is_ref = (
            source == "webcam"
            and idx == 0
            and not any(p.user_id == user_id and p.is_reference for p in DB.photos.values())
        )
        ph = Photo(id=pid, user_id=user_id, path=path, source=source, is_reference=is_ref, verified=False)
        DB.photos[pid] = ph
        created.append(
            {
                "id": ph.id,
                "path": ph.path,
                "source": ph.source,
                "isReference": ph.is_reference,
                "verified": ph.verified,
                "createdAt": ph.created_at,
            }
        )

    return {"success": True, "photos": created}

@router.get("")
def list_photos(authorization: str | None = None):
    user = get_current_user(authorization)
    user_id = user["id"]
    photos = [p for p in DB.photos.values() if p.user_id == user_id]
    return {
        "photos": [
            {
                "id": p.id,
                "url": f"/storage/users/{user_id}/photos/{os.path.basename(p.path)}",
                "source": p.source,
                "isReference": p.is_reference,
                "verified": p.verified,
                "createdAt": p.created_at,
            }
            for p in sorted(photos, key=lambda x: x.created_at)
        ],
        "hasReference": any(p.is_reference and p.source == "webcam" for p in photos),
    }

@router.delete("/{photo_id}")
def delete_photo(photo_id: str, authorization: str | None = None):
    user = get_current_user(authorization)
    user_id = user["id"]
    p = DB.photos.get(photo_id)
    if not p or p.user_id != user_id:
        raise HTTPException(status_code=404, detail="Not found")
    delete_file(p.path)
    del DB.photos[photo_id]
    return {"success": True}

@router.post("/verify")
def verify_photos(payload: PhotoVerifyIn, authorization: str | None = None):
    user = get_current_user(authorization)
    user_id = user["id"]

    for pid in payload.photoIds:
        if pid not in DB.photos or DB.photos[pid].user_id != user_id:
            raise HTTPException(status_code=404, detail=f"Photo not found: {pid}")

    try:
        verified, ref_id, failed_id, similarity = verify_photos_against_reference(payload.photoIds, threshold=0.80)
    except ValueError as e:
        if str(e) == "MISSING_REFERENCE":
            raise HTTPException(
                status_code=400,
                detail={"error": True, "code": "MISSING_REFERENCE", "message": "Au moins une photo webcam de référence est requise pour la vérification"},
            )
        raise HTTPException(status_code=400, detail=str(e))

    if verified:
        for pid in payload.photoIds:
            DB.photos[pid].verified = True
        return {
            "success": True,
            "verified": True,
            "referencePhotoId": ref_id,
            "verifiedCount": len(payload.photoIds),
            "message": "All photos match the reference",
        }
    else:
        return {
            "success": True,
            "verified": False,
            "referencePhotoId": ref_id,
            "failedPhotoId": failed_id,
            "similarity": round(similarity * 100, 1),
            "threshold": 80,
            "message": f"Photo {failed_id} does not match the reference",
        }
