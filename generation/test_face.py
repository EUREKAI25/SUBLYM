#!/usr/bin/env python3
"""Test rapide : génération + validation d'UNE image."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from services.image_generator import ImageGenerator
from services.image_validator import ImageValidator

PHOTO_REF = "/Users/nathalie/Dropbox/____BIG_BOFF___/PROJETS/PRO/SUBLYM0118/photos/IMG_2913.jpeg"
OUTPUT = "/tmp/test_face_output.png"

config = {
    "models": {
        "image": "gemini-3-pro-image-preview",
        "vision": "gemini-2.0-flash",
    },
    "global_min_score": 0.75,
    "validation_config": {
        "face_shape": {"min": 0.8, "ref": "user_photo", "label": "Forme du visage IDENTIQUE"},
        "face_features": {"min": 0.8, "ref": "user_photo", "label": "Traits du visage = MÊME PERSONNE"},
        "skin_tone": {"min": 0.8, "ref": "user_photo", "label": "Teinte de peau exacte"},
        "hair_color": {"min": 0.8, "ref": "user_photo", "label": "Couleur cheveux exacte"},
        "hair_type": {"min": 0.8, "ref": "user_photo", "label": "Texture IDENTIQUE"},
        "no_deformation": {"min": 0.9, "ref": "none", "label": "Aucune déformation"},
    },
    "face_validation": {
        "tolerance": 0.3,
        "threshold": 0.8,
    },
}

scene = {
    "description": "Cette personne marche dans Central Park sous la neige à New York",
    "location": "Central Park, New York, hiver, neige",
    "pose": "debout, en train de marcher",
    "expression": "émerveillement",
    "expression_intensity": "moderate",
    "gaze_direction": "away_left",
    "outfit": "manteau gris, écharpe bleu marine, bonnet blanc",
    "accessories": "",
}

shooting = {
    "shot_type": "medium",
    "camera_angle": "eye_level",
    "lighting_direction": "side",
    "lighting_temperature": "warm",
    "depth_of_field": "shallow",
    "focus_on": "face",
}

print("=" * 60)
print("TEST GÉNÉRATION + VALIDATION")
print("=" * 60)

# 1. Générer
gen = ImageGenerator(config, verbose=True)
result = gen.generate_keyframe(
    scene_description=scene,
    shooting_specs=shooting,
    reference_images=[PHOTO_REF],
    scene_palette=["#FFFFFF", "#C0C0C0", "#2F4F4F"],
    is_same_day=False,
    output_path=OUTPUT,
)

if not result.get("success"):
    print(f"\n❌ Génération échouée: {result.get('error')}")
    sys.exit(1)

print(f"\n✅ Image générée: {OUTPUT}")

# 2. Valider
validator = ImageValidator(config, verbose=True)
validator.set_run_dir("/tmp")

val = validator.validate(
    image_path=OUTPUT,
    references={"user_photo": PHOTO_REF},
    scene_id=1,
    kf_type="start",
    palette=["#FFFFFF", "#C0C0C0", "#2F4F4F"],
    description=scene["description"],
)

print(f"\n{'=' * 60}")
print(f"RÉSULTAT: {'✅ PASS' if val['passed'] else '❌ FAIL'}")
print(f"Gemini score: {val.get('global_score', 0):.2f}")
if val.get("face_validation"):
    fv = val["face_validation"]
    print(f"DeepFace: {fv['scores']['deepface']:.4f}")
    print(f"ArcFace:  {fv['scores']['arcface']:.4f}")
    print(f"Gap:      {fv['cumulative_gap']:.4f} (tolérance: 0.3)")
if val.get("failures"):
    print(f"Échecs:   {val['failures']}")
print(f"{'=' * 60}")
