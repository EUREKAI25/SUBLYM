from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import time
import uuid

def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"

@dataclass
class Photo:
    id: str
    user_id: str
    path: str
    source: str  # "webcam" | "upload"
    is_reference: bool
    verified: bool = False
    created_at: str = field(default_factory=now_iso)

@dataclass
class Dream:
    id: str
    user_id: str
    description: str
    reject: List[str]
    style: str
    photo_ids: List[str]
    decor_photo_ids: List[str]
    status: str = "draft"
    created_at: str = field(default_factory=now_iso)
    last_run_id: Optional[str] = None

@dataclass
class Run:
    id: str
    trace_id: str
    user_id: str
    dream_id: str
    status: str = "queued"
    progress: int = 0
    current_step: str = "Queued"
    estimated_remaining: int = 0
    created_at: str = field(default_factory=now_iso)
    video_path: Optional[str] = None
    teaser_path: Optional[str] = None
    manifest_path: Optional[str] = None
    error_message: Optional[str] = None

class MemoryDB:
    def __init__(self):
        self.photos: Dict[str, Photo] = {}
        self.dreams: Dict[str, Dream] = {}
        self.runs: Dict[str, Run] = {}

DB = MemoryDB()
