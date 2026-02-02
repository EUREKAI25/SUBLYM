"""
Sublym v4 - Video Generator
"""

import json
import base64
import time
import urllib.request
import mimetypes
from typing import Dict, Optional
from pathlib import Path

from .env_loader import get_api_key
from config.settings import DEFAULT_MODELS
from prompts.templates import PROMPT_VIDEO, PROMPT_VIDEO_POV

FAL_BASE_URL = "https://fal.run/"


class VideoGenerator:
    """Génère les vidéos via fal.ai."""

    def __init__(self, config: Dict, output_dir: str = "./output/videos_temp",
                 dry_run: bool = False, verbose: bool = False):
        self.config = config
        self.dry_run = dry_run
        self.verbose = verbose
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.video_model = config.get("models", {}).get("video", DEFAULT_MODELS["video"])

        self.costs_real = {"videos": 0, "duration_total": 0}
    
    def generate(self, start_image: str, end_image: str, action: str,
                 camera_movement: str = "static", is_pov: bool = False,
                 duration: int = 6, output_path: Optional[str] = None) -> Dict:
        
        if self.dry_run:
            return self._mock_generate(output_path)
        
        if is_pov:
            prompt = PROMPT_VIDEO_POV.format(duration=duration, action=action)
        else:
            prompt = PROMPT_VIDEO.format(duration=duration, action=action, camera_movement=camera_movement)
        
        if self.verbose:
            print(f"\n--- PROMPT VIDEO ---\n{prompt}\n---")
        
        return self._call_fal(prompt, start_image, end_image, output_path, duration)
    
    def _call_fal(self, prompt, start_path, end_path, output_path, duration):
        api_key = get_api_key("FAL_KEY")
        
        def to_data_uri(path):
            mime, _ = mimetypes.guess_type(path)
            with open(path, "rb") as f:
                data = base64.b64encode(f.read()).decode("utf-8")
            return f"data:{mime or 'image/png'};base64,{data}"
        
        print(f"   [fal.ai] Génération vidéo...")
        
        payload = {
            "prompt": prompt,
            "image_url": to_data_uri(start_path),
            "end_image_url": to_data_uri(end_path),
            "prompt_optimizer": False
        }

        req = urllib.request.Request(
            f"{FAL_BASE_URL}{self.video_model}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Authorization": f"Key {api_key}", "Content-Type": "application/json"}
        )
        
        try:
            with urllib.request.urlopen(req, timeout=600) as response:
                result = json.loads(response.read().decode("utf-8"))
            
            video_url = result.get("video", {}).get("url")
            
            if video_url:
                video_path = output_path or str(self.output_dir / f"video_{int(time.time())}.mp4")
                Path(video_path).parent.mkdir(parents=True, exist_ok=True)
                urllib.request.urlretrieve(video_url, video_path)
                
                self.costs_real["videos"] += 1
                self.costs_real["duration_total"] += duration
                
                print(f"   [fal.ai] ✓ {video_path}")
                return {"success": True, "video_path": video_path, "video_url": video_url}
            
            return {"success": False, "error": "No video URL"}
            
        except Exception as e:
            print(f"   [fal.ai] ❌ {e}")
            return {"success": False, "error": str(e)}
    
    def _mock_generate(self, output_path):
        print(f"   [DRY RUN] Vidéo simulée")
        if output_path:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            Path(output_path).touch()
        return {"success": True, "video_path": output_path, "mock": True}
    
    def get_real_cost(self):
        cost_per_sec = self.config.get("costs", {}).get("video_per_second", 0.045)
        return self.costs_real["duration_total"] * cost_per_sec
