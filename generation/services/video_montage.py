"""
Sublym v4 - Video Montage
"""

import subprocess
from typing import List, Optional
from pathlib import Path


class VideoMontage:
    """Assemble les vidéos via ffmpeg."""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
    
    def concat(self, video_paths: List[str], output_path: str, timeout: int = 120) -> dict:
        if not video_paths:
            return {"success": False, "error": "No videos"}
        
        valid = [p for p in video_paths if Path(p).exists()]
        if not valid:
            return {"success": False, "error": "No valid videos"}
        
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        
        list_file = Path(output_path).parent / "concat_list.txt"
        with open(list_file, "w") as f:
            for vp in valid:
                f.write(f"file '{vp}'\n")
        
        cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_file),
               "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p", str(output_path)]
        
        print(f"   [ffmpeg] Montage {len(valid)} vidéos...")
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            if result.returncode == 0 and Path(output_path).exists():
                duration = self._get_duration(output_path)
                print(f"   [ffmpeg] ✓ {output_path} ({duration:.1f}s)")
                return {"success": True, "output_path": output_path, "duration": duration}
            return {"success": False, "error": result.stderr[:200]}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_real_cost(self) -> float:
        return 0.0  # ffmpeg = gratuit

    def _get_duration(self, path):
        try:
            cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                   "-of", "default=noprint_wrappers=1:nokey=1", str(path)]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            return float(result.stdout.strip()) if result.stdout.strip() else 0
        except:
            return 0
