#!/usr/bin/env python3
"""Quick test: Gemini 2.5 Flash vision validation with responseMimeType."""

import sys
import json
import base64
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from services.env_loader import get_api_key

# Paths
JULIEN_DIR = Path("/Users/nathalie/Dropbox/____BIG_BOFF___/PROJETS/PRO/SUBLYM_APP_PUB/Avatars/Julien36/Julien")
REF_PHOTO = JULIEN_DIR / "Julien_laughing.png"
GENERATED = JULIEN_DIR / "output/dreams/julien_i_would_love_to_live_and_work__1ce70dc4/keyframes/start_keyframe_0A.png"

MODEL = "gemini-2.5-flash"

def encode_image(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def test_validation():
    api_key = get_api_key("GEMINI_API_KEY")

    print(f"Model: {MODEL}")
    print(f"Ref: {REF_PHOTO}")
    print(f"Gen: {GENERATED}")

    if not REF_PHOTO.exists():
        print(f"Ref photo not found: {REF_PHOTO}")
        return
    if not GENERATED.exists():
        print(f"Generated image not found: {GENERATED}")
        return

    ref_b64 = encode_image(str(REF_PHOTO))
    gen_b64 = encode_image(str(GENERATED))

    prompt = """Compare IMAGE 2 (generated) against IMAGE 1 (reference photo).
IMAGE 1 = REFERENCE PHOTO (the real person)
IMAGE 2 = GENERATED IMAGE (to evaluate)

Score each criterion 0-1:
- face_shape: Same face shape?
- face_features: Same person?
- skin_tone: Same skin tone?
- hair_color: Same hair color?
- natural_pose: Natural pose?
- no_deformation: No deformation?

Reply in JSON:
{
    "scores": {"criterion_code": {"score": 0.0, "comment": "explanation"}},
    "global_score": 0.0,
    "is_same_person": true|false,
    "major_issues": ["list of problems"]
}"""

    parts = [
        {"inline_data": {"mime_type": "image/png", "data": ref_b64}},
        {"inline_data": {"mime_type": "image/png", "data": gen_b64}},
        {"text": prompt}
    ]

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 4000,
            "responseMimeType": "application/json"
        }
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={api_key}"

    print(f"\nCalling {MODEL}...")
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )

    with urllib.request.urlopen(req, timeout=120) as response:
        result = json.loads(response.read().decode("utf-8"))

    # Check response structure
    print(f"\nResponse keys: {list(result.keys())}")

    usage = result.get("usageMetadata", {})
    print(f"Tokens in: {usage.get('promptTokenCount', '?')}, out: {usage.get('candidatesTokenCount', '?')}")

    try:
        text = result["candidates"][0]["content"]["parts"][0]["text"]
        print(f"\nRaw response (first 1000 chars):\n{text[:1000]}")

        # Try parsing
        parsed = json.loads(text)
        print(f"\nParsed OK!")
        print(f"Global score: {parsed.get('global_score')}")
        print(f"Is same person: {parsed.get('is_same_person')}")
        print(f"Major issues: {parsed.get('major_issues')}")
        if parsed.get("scores"):
            print("\nScores:")
            for k, v in parsed["scores"].items():
                if isinstance(v, dict):
                    print(f"  {k}: {v.get('score', '?')} — {v.get('comment', '')[:80]}")
                else:
                    print(f"  {k}: {v}")
    except (KeyError, IndexError) as e:
        finish_reason = result.get("candidates", [{}])[0].get("finishReason", "unknown")
        print(f"\nNo text in response! finishReason={finish_reason}")
        print(f"Full candidates: {json.dumps(result.get('candidates', []), indent=2)[:500]}")
    except json.JSONDecodeError as e:
        print(f"\nJSON parse error: {e}")
        print(f"Raw text: {text[:500]}")

if __name__ == "__main__":
    test_validation()
