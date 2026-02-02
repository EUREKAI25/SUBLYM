import hashlib
from typing import List, Tuple, Optional
from ..db.memory import DB

# MVP: deterministic pseudo-similarity based on file bytes hash prefix.
# Replace with AWS Rekognition CompareFaces in prod.

def _hash(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()

def verify_photos_against_reference(photo_ids: List[str], threshold: float = 0.80) -> Tuple[bool, str, Optional[str], float]:
    photos = []
    for pid in photo_ids:
        if pid not in DB.photos:
            raise ValueError(f"Photo not found: {pid}")
        photos.append(DB.photos[pid])

    ref = next((p for p in photos if p.is_reference and p.source == "webcam"), None)
    if not ref:
        raise ValueError("MISSING_REFERENCE")

    refh = _hash(ref.path)
    failed = None
    sim = 1.0
    for p in photos:
        if p.id == ref.id:
            continue
        ph = _hash(p.path)
        common = 0
        for a, b in zip(refh, ph):
            if a == b:
                common += 1
            else:
                break
        sim = common / 64.0
        if sim < threshold:
            failed = p.id
            break
    verified = failed is None
    return verified, ref.id, failed, sim
