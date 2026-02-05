#!/usr/bin/env python3
"""Test: minimax suit-il un prompt détaillé step-by-step ?
Compare vidéo avec prompt vague vs prompt détaillé.
"""

import sys
import json
import base64
import time
import mimetypes
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from services.env_loader import get_api_key

KF_DIR = Path("/Users/nathalie/Dropbox/____BIG_BOFF___/PROJETS/PRO/SUBLYM_APP_PUB/Avatars/Julien36/Julien/output/dreams/julien_i_would_love_to_live_and_work__bd2cdab8/keyframes")
OUT_DIR = KF_DIR.parent / "test_prompts"
OUT_DIR.mkdir(exist_ok=True)

VIDEO_MODEL = "fal-ai/minimax/hailuo-02/standard/image-to-video"
FAL_BASE_URL = "https://fal.run/"


def to_data_uri(path):
    mime, _ = mimetypes.guess_type(str(path))
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime or 'image/png'};base64,{data}"


def generate_video(prompt, start_image, end_image, output_path):
    api_key = get_api_key("FAL_KEY")

    payload = {
        "prompt": prompt,
        "image_url": to_data_uri(start_image),
        "end_image_url": to_data_uri(end_image),
        "prompt_optimizer": False
    }

    print(f"  Calling fal.ai...")
    req = urllib.request.Request(
        f"{FAL_BASE_URL}{VIDEO_MODEL}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Key {api_key}", "Content-Type": "application/json"}
    )

    with urllib.request.urlopen(req, timeout=600) as response:
        result = json.loads(response.read().decode("utf-8"))

    video_url = result.get("video", {}).get("url")
    if video_url:
        urllib.request.urlretrieve(video_url, str(output_path))
        print(f"  OK: {output_path}")
        return True
    else:
        print(f"  FAIL: no video URL")
        return False


if __name__ == "__main__":
    start_0A = KF_DIR / "start_keyframe_0A.png"
    end_0A = KF_DIR / "end_keyframe_0A.png"
    start_D = KF_DIR / "start_keyframe_D.png"
    end_D = KF_DIR / "end_keyframe_D.png"

    # ====== TEST A: Scene 0A — prompt détaillé ======
    print("=" * 60)
    print("TEST A: Scene 0A — prompt step-by-step détaillé")
    print("=" * 60)

    prompt_A = """Smooth 6-second cinematic video.

CHARACTER ACTION: Man sitting at desk slowly shifts his weight and drifts into thought.

STEP BY STEP:
- 0-1s: Man sits at desk, eyes on computer screen, expression slightly bored, shoulders hunched forward
- 1-2s: He slowly exhales, leans back slightly in his chair, eyes still on screen but losing focus
- 2-3s: His gaze drifts away from screen, looking slightly upward and to the right, thoughtful
- 3-4s: He brings one hand to his chin, resting it thoughtfully, slight frown
- 4-5s: His eyes become distant, unfocused, as if imagining something far away
- 5-6s: A hint of longing crosses his face, he's completely lost in thought

CAMERA: static
BACKGROUND: Completely static. Grey apartment walls, desk, computer unchanged throughout.
EMOTION: boredom → distraction → longing

RULES:
1. Video MUST start exactly like first image and end exactly like last image
2. Background COMPLETELY STATIC - nothing moves except the character
3. Do NOT morph, stretch, or deform any objects
4. Character's face must stay IDENTICAL throughout
5. Smooth, natural human movement only"""

    print(f"  Start: {start_0A}")
    print(f"  End: {end_0A}")
    generate_video(prompt_A, str(start_0A), str(end_0A), OUT_DIR / "test_A_scene0A_detailed.mp4")

    # ====== TEST B: Scene D — prompt détaillé ======
    print()
    print("=" * 60)
    print("TEST B: Scene D — prompt step-by-step détaillé")
    print("=" * 60)

    prompt_B = """Smooth 6-second cinematic video.

CHARACTER ACTION: Man suddenly realizes his surroundings have changed, looks around in growing wonder.

STEP BY STEP:
- 0-1s: Man sits in same position as before, but blinks rapidly, noticing the light around him has changed
- 1-2s: His eyes widen, he slowly turns his head to the left, mouth slightly open in disbelief
- 2-3s: He turns his head to the right, taking in the new bright environment, eyebrows raised high
- 3-4s: He slowly stands up from the chair, hands gripping the desk edge for support
- 4-5s: Standing now, he looks down at his hands, then back up at the bright room around him
- 5-6s: A warm smile begins to form, eyes bright with wonder, he takes a half step forward

CAMERA: static
BACKGROUND: Completely static. Bright NYC loft interior with large windows, warm natural light.
EMOTION: confusion → disbelief → wonder → beginning of joy

RULES:
1. Video MUST start exactly like first image and end exactly like last image
2. Background COMPLETELY STATIC - nothing moves except the character
3. Do NOT morph, stretch, or deform any objects
4. Character's face must stay IDENTICAL throughout
5. Smooth, natural human movement only"""

    print(f"  Start: {start_D}")
    print(f"  End: {end_D}")
    generate_video(prompt_B, str(start_D), str(end_D), OUT_DIR / "test_B_sceneD_detailed.mp4")

    print()
    print("=" * 60)
    print(f"DONE — vidéos dans: {OUT_DIR}")
    print("=" * 60)
