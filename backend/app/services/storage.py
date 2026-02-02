import os
from ..core.settings import settings

def user_photo_dir(user_id: str) -> str:
    d = os.path.join(settings.storage_root, "users", user_id, "photos")
    os.makedirs(d, exist_ok=True)
    return d

def user_dream_dir(user_id: str, dream_id: str) -> str:
    d = os.path.join(settings.storage_root, "users", user_id, "dreams", dream_id)
    os.makedirs(d, exist_ok=True)
    return d

def save_upload_bytes(user_id: str, filename: str, content: bytes) -> str:
    d = user_photo_dir(user_id)
    path = os.path.join(d, filename)
    with open(path, "wb") as f:
        f.write(content)
    return path

def delete_file(path: str):
    try:
        os.remove(path)
    except FileNotFoundError:
        return
