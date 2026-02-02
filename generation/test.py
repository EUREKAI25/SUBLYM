#!/usr/bin/env python3
"""
Sublym v4 - Test Runner
TOUTE LA CONFIGURATION EST ICI
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from pipeline import DreamPipeline
from config.settings import PRESETS

CHARACTER_NAME = "Julien"
CHARACTER_GENDER = "male"

# Chemins via variable d'env ou defaut relatif
AVATARS_BASE = os.environ.get("SUBLYM_AVATARS_DIR",
    str(Path(__file__).resolve().parent.parent.parent / "SUBLYM_APP_PUB" / "Avatars"))

CLAIRE_DIR = os.path.join(AVATARS_BASE, "Claire48", "Claire")
SOPHIE_DIR = os.path.join(AVATARS_BASE, "Sophie42", "Sophie")
JULIEN_DIR = os.path.join(AVATARS_BASE, "Julien36", "Julien")

USER_PHOTOS_DIR = Path(JULIEN_DIR)
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}
USER_PHOTOS = [str(p) for p in sorted(USER_PHOTOS_DIR.iterdir())
               if p.is_file() and not p.name.startswith('.') and p.suffix.lower() in IMAGE_EXTENSIONS]

DREAM_FILE = USER_PHOTOS_DIR / "dream.txt"
if DREAM_FILE.exists():
    DREAM_STATEMENT = DREAM_FILE.read_text(encoding="utf-8")
else:
    DREAM_STATEMENT = """
    Je rêve de partir vivre au bord de la mer Méditerranée.
    Une maison lumineuse avec une grande terrasse qui donne sur l'eau.
    """

OUTPUT_DIR = USER_PHOTOS_DIR / "output" / "dreams"

NB_SCENES = 4
NB_POV_SCENES = 1
MODE = "scenario"
IMPOSED_SCENES = None


CUSTOM_PALETTE = None
PALETTE_MUST_COMPLEMENT_SKIN = True

SHOT_TYPES = ["close_up", "medium", "medium_full", "full", "wide"]
CAMERA_ANGLES = ["eye_level", "low_angle", "high_angle"]
CAMERA_MOVEMENTS = ["static", "slow_pan_left", "slow_pan_right", "slow_zoom_in", "slow_zoom_out", "tracking"]
LIGHTING_DIRECTIONS = ["front", "side", "back", "rim"]
LIGHTING_TEMPERATURES = ["warm", "neutral", "cool"]
DEPTH_OF_FIELD_OPTIONS = ["shallow", "medium", "deep"]
FOCUS_OPTIONS = ["face", "eyes", "full_body", "foreground_object"]

EXPRESSION_INTENSITIES = ["subtle", "moderate", "pronounced"]
GAZE_DIRECTIONS = ["away_left", "away_right", "down", "up", "distant", "at_object"]

VALIDATION_CONFIG = {
    "face_shape": {"min": 0.8, "ref": "user_photo", "label": "Forme du visage IDENTIQUE"},
    "face_features": {"min": 0.8, "ref": "user_photo", "label": "Traits du visage = MÊME PERSONNE"},
    "skin_tone": {"min": 0.8, "ref": "user_photo", "label": "Teinte de peau exacte"},
    "age": {"min": 0.7, "ref": "character_analysis", "label": "Âge apparent"},
    "body_type": {"min": 0.8, "ref": "user_photo", "label": "Corpulence IDENTIQUE"},
    "body_build": {"min": 0.8, "ref": "user_photo", "label": "Carrure IDENTIQUE"},
    "hair_color": {"min": 0.8, "ref": "user_photo", "label": "Couleur cheveux exacte"},
    "hair_length": {"min": 0.8, "ref": "user_photo", "label": "Longueur IDENTIQUE"},
    "hair_type": {"min": 0.8, "ref": "user_photo", "label": "Texture IDENTIQUE"},
    "hair_style": {"min": 0.8, "ref": "previous", "label": "Coiffure IDENTIQUE si same_day"},
    "glasses_present": {"min": 0.95, "ref": "user_photo", "label": "Lunettes présentes si ref en a"},
    "glasses_style": {"min": 0.8, "ref": "user_photo", "label": "Style monture IDENTIQUE"},
    "clothing_style": {"min": 0.8, "ref": "previous", "label": "MÊME vêtement"},
    "clothing_color": {"min": 0.8, "ref": "previous", "label": "Couleur IDENTIQUE"},
    "clothing_pattern": {"min": 0.8, "ref": "previous", "label": "Motif IDENTIQUE"},
    "clothing_fit": {"min": 0.7, "ref": "previous", "label": "Coupe IDENTIQUE"},
    "accessories_present": {"min": 0.8, "ref": "previous", "label": "MÊMES accessoires"},
    "accessories_color": {"min": 0.8, "ref": "previous", "label": "Couleur accessoires IDENTIQUE"},
    "accessories_pattern": {"min": 0.8, "ref": "previous", "label": "Motif IDENTIQUE"},
    "location_match_pitch": {"min": 0.7, "ref": "pitch", "label": "Lieu correspond à description"},
    "location_consistency": {"min": 0.85, "ref": "start_current", "label": "MÊME lieu que start"},
    "background_elements": {"min": 0.8, "ref": "start_current", "label": "Arrière-plan IDENTIQUE"},
    "shot_type_match": {"min": 0.8, "ref": "pitch", "label": "Type de plan respecté"},
    "camera_angle_match": {"min": 0.8, "ref": "pitch", "label": "Angle caméra respecté"},
    "lighting_direction_match": {"min": 0.7, "ref": "pitch", "label": "Direction lumière respectée"},
    "lighting_temperature_match": {"min": 0.8, "ref": "pitch", "label": "Température couleur respectée"},
    "depth_of_field_match": {"min": 0.7, "ref": "pitch", "label": "Profondeur de champ respectée"},
    "palette_compliance": {"min": 0.7, "ref": "scene_palette", "label": "Couleurs dans la palette"},
    "emotion_match": {"min": 0.8, "ref": "pitch", "label": "Émotion correspond"},
    "expression_readable": {"min": 0.8, "ref": "none", "label": "Émotion clairement lisible"},
    "positive_expression": {"min": 0.8, "ref": "none", "label": "Expression POSITIVE: content, épanoui, souriant"},
    "no_exaggeration": {"min": 0.9, "ref": "none", "label": "Pas de surjeu"},
    "natural_pose": {"min": 0.8, "ref": "none", "label": "Pose naturelle"},
    "gaze_correct": {"min": 0.95, "ref": "none", "label": "Regard PAS vers caméra"},
    "no_camera_look": {"min": 0.95, "ref": "none", "label": "Ne regarde JAMAIS l'objectif"},
    "no_mirror": {"min": 0.95, "ref": "none", "label": "Aucun miroir"},
    "no_text": {"min": 0.95, "ref": "none", "label": "Aucun texte visible"},
    "no_watermark": {"min": 0.95, "ref": "none", "label": "Aucun watermark"},
    "no_deformation": {"min": 0.9, "ref": "none", "label": "Aucune déformation"},
    "action_match": {"min": 0.7, "ref": "pitch", "label": "Action correspond"},
}

GLOBAL_MIN_SCORE = 0.75
MAX_ATTEMPTS = 5

MODELS = {
    "scenario": "gpt-4o",
    "image": "gemini-3-pro-image-preview",
    "vision": None,  # Désactivé: DeepFace + ArcFace suffisent pour la validation faciale
    "video": "fal-ai/minimax/hailuo-02/standard/image-to-video",
}

PROMPT_STRICT_PREFIX = """
STRICT INSTRUCTIONS - NO IMPROVISATION ALLOWED.
You MUST follow EVERY indication below TO THE LETTER.
Take NO creative liberty. Follow the specs EXACTLY.
"""

PROMPT_STRICT_SUFFIX = """
FINAL CHECKLIST - VERIFY BEFORE GENERATING:
- Person from the reference photo EXACTLY reproduced
- IDENTICAL face (same person, not just resembling)
- IDENTICAL body type as reference
- IDENTICAL outfit/accessories if same_day
- Scene color palette RESPECTED
- Framing/lighting/depth of field RESPECTED
- Emotion CLEAR but NEVER exaggerated
- Gaze NEVER toward camera (unless explicitly allowed)
- NO mirror, NO text, NO deformation
ANY DEVIATION = FAILURE.
"""

# =============================================================================
# ÉTAPES À EXÉCUTER
# =============================================================================

STEPS = PRESETS["full"]
# STEPS = PRESETS["scenario_only"]
# STEPS = PRESETS["keyframes_only"]

DRY_RUN = False
VERBOSE = True

KEYFRAMES_DIR = None
VIDEOS_DIR = None
SCENARIO_JSON = None

# =============================================================================
# LANCEMENT
# =============================================================================

if __name__ == "__main__":
    if not USER_PHOTOS_DIR.exists():
        print(f"❌ Répertoire non trouvé: {USER_PHOTOS_DIR}")
        sys.exit(1)
    
    if not USER_PHOTOS:
        print(f"❌ Aucune photo dans: {USER_PHOTOS_DIR}")
        sys.exit(1)
    
    print(f"📷 {len(USER_PHOTOS)} photos")
    
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Configuration complète
    config = {
        "nb_scenes": NB_SCENES,
        "nb_pov_scenes": NB_POV_SCENES,
        "mode": MODE,
        "imposed_scenes": IMPOSED_SCENES,
        "custom_palette": CUSTOM_PALETTE,
        "palette_complement_skin": PALETTE_MUST_COMPLEMENT_SKIN,
        "shot_types": SHOT_TYPES,
        "camera_angles": CAMERA_ANGLES,
        "camera_movements": CAMERA_MOVEMENTS,
        "lighting_directions": LIGHTING_DIRECTIONS,
        "lighting_temperatures": LIGHTING_TEMPERATURES,
        "depth_of_field_options": DEPTH_OF_FIELD_OPTIONS,
        "focus_options": FOCUS_OPTIONS,
        "expression_intensities": EXPRESSION_INTENSITIES,
        "gaze_directions": GAZE_DIRECTIONS,
        "validation_config": VALIDATION_CONFIG,
        "global_min_score": GLOBAL_MIN_SCORE,
        "max_attempts": MAX_ATTEMPTS,
        "models": MODELS,
        "prompt_strict_prefix": PROMPT_STRICT_PREFIX,
        "prompt_strict_suffix": PROMPT_STRICT_SUFFIX,
    }
    
    # Pipeline avec config (PAS MAX_ATTEMPTS directement !)
    pipeline = DreamPipeline(
        output_dir=str(OUTPUT_DIR),
        dry_run=DRY_RUN,
        verbose=VERBOSE,
        config=config
    )
    
    results = pipeline.run(
        steps=STEPS,
        dream_statement=DREAM_STATEMENT,
        user_photos=USER_PHOTOS,
        character_name=CHARACTER_NAME,
        character_gender=CHARACTER_GENDER,
        keyframes_dir=KEYFRAMES_DIR,
        videos_dir=VIDEOS_DIR,
        scenario_json=SCENARIO_JSON,
    )
    
    print("\n" + "=" * 70)
    if results.get("success"):
        print("🎉 Terminé avec succès!")
    else:
        print("⚠️ Terminé avec des problèmes")
    
    if results.get("costs_real"):
        print(f"\n💰 COÛTS RÉELS:")
        for service, cost in results["costs_real"].items():
            print(f"   - {service}: {cost:.4f}€")
        print(f"   TOTAL: {sum(results['costs_real'].values()):.4f}€")
    
    sys.exit(0 if results.get("success") else 1)