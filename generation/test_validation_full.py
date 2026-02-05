#!/usr/bin/env python3
"""Test complet: ImageValidator + FaceValidator sur une keyframe existante."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from services.image_validator import ImageValidator

JULIEN_DIR = Path("/Users/nathalie/Dropbox/____BIG_BOFF___/PROJETS/PRO/SUBLYM_APP_PUB/Avatars/Julien36/Julien")
RUN_DIR = JULIEN_DIR / "output/dreams/julien_i_would_love_to_live_and_work__1ce70dc4"

REF_PHOTO = str(JULIEN_DIR / "Julien_laughing.png")
GENERATED = str(RUN_DIR / "keyframes/start_keyframe_0A.png")

# Config identique à test.py
config = {
    "models": {"vision": "gemini-2.5-flash"},
    "prompt_strict_prefix": "",
    "prompt_strict_suffix": "",
    "validation_config": {
        "face_shape": {"min": 0.8, "ref": "user_photo", "label": "Forme du visage IDENTIQUE"},
        "face_features": {"min": 0.8, "ref": "user_photo", "label": "Traits du visage = MÊME PERSONNE"},
        "skin_tone": {"min": 0.8, "ref": "user_photo", "label": "Teinte de peau exacte"},
        "hair_color": {"min": 0.8, "ref": "user_photo", "label": "Couleur cheveux exacte"},
        "natural_pose": {"min": 0.8, "ref": "none", "label": "Pose naturelle"},
        "no_deformation": {"min": 0.9, "ref": "none", "label": "Aucune déformation"},
    },
    "global_min_score": 0.75,
    "face_validation": {"tolerance": 0.3, "threshold": 0.8},
    "face_tolerance_by_shot": {
        "close_up": 0.2,
        "medium": 0.3,
        "medium_full": 0.4,
        "full": 0.5,
        "wide": 0.6,
        "far": 0.6,
        "profile": 0.4,
        "back_three_quarter": None,
    },
}

if __name__ == "__main__":
    print("=" * 60)
    print("TEST COMPLET: ImageValidator + FaceValidator")
    print("=" * 60)

    if not Path(REF_PHOTO).exists():
        print(f"Ref not found: {REF_PHOTO}")
        sys.exit(1)
    if not Path(GENERATED).exists():
        print(f"Generated not found: {GENERATED}")
        sys.exit(1)

    validator = ImageValidator(config, dry_run=False, verbose=True)
    validator.set_run_dir(str(RUN_DIR))

    print(f"\nRef: {REF_PHOTO}")
    print(f"Gen: {GENERATED}")

    # Test 1: medium shot (standard)
    print("\n" + "=" * 60)
    print("TEST 1: shot_type=medium, expected_faces=1")
    print("=" * 60)
    result = validator.validate(
        image_path=GENERATED,
        references={"user_photo": REF_PHOTO, "previous": None, "start_current": None},
        scene_id=99,
        kf_type="start",
        palette=["#B0B0B0", "#7D7D7D"],
        description="Test scene: homme assis à un bureau",
        attempt=1,
        shot_type="medium",
        expected_faces=1,
    )
    print(f"\nRESULT: passed={result['passed']}, score={result['global_score']}")
    print(f"Failures: {result['failures']}")
    print(f"Face: {result.get('face_validation', {})}")

    # Test 2: back_three_quarter (should skip face)
    print("\n" + "=" * 60)
    print("TEST 2: shot_type=back_three_quarter (face skip)")
    print("=" * 60)
    result2 = validator.validate(
        image_path=GENERATED,
        references={"user_photo": REF_PHOTO, "previous": None, "start_current": None},
        scene_id=98,
        kf_type="start",
        palette=["#B0B0B0"],
        description="Test: personnage de dos",
        attempt=1,
        shot_type="back_three_quarter",
        expected_faces=1,
    )
    print(f"\nRESULT: passed={result2['passed']}, score={result2['global_score']}")
    print(f"Face: {result2.get('face_validation', {})}")

    print("\n" + "=" * 60)
    print("DONE")
    print("=" * 60)
