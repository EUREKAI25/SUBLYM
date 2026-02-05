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

# Photos de Julien
JULIEN_PHOTOS_DIR = Path("/Users/nathalie/Dropbox/____BIG_BOFF___/PROJETS/PRO/SUBLYM_APP_PUB/Avatars/Julien36/Julien")
USER_PHOTOS = [
    str(JULIEN_PHOTOS_DIR / "Julien_laughing.png"),
    str(JULIEN_PHOTOS_DIR / "Julien_souriant.png"),
    str(JULIEN_PHOTOS_DIR / "scene03_start_att2_193548.jpg"),
]
USER_PHOTOS_DIR = JULIEN_PHOTOS_DIR

DREAM_STATEMENT = "I would love to live and work in NewYork. Living in a big loft with a terrace to see the skyline, and work at home or in an open workspace. I would travel a lot all around the world but always come back in NYC"

OUTPUT_DIR = JULIEN_PHOTOS_DIR / "output" / "dreams"

NB_SCENES = 0          # 0 dream scenes — After = D (choc) + E (explore) uniquement
NB_POV_SCENES = 0
MODE = "scenario_pub"
NB_SCENES_AVANT = 1    # 1 scène quotidien
IMPOSED_SCENES = None


CUSTOM_PALETTE = None
PALETTE_MUST_COMPLEMENT_SKIN = True

SHOT_TYPES = ["close_up", "medium", "medium_full", "full", "wide", "profile", "back_three_quarter", "far"]
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
    "scenario_validation": "gpt-4o-mini",
    "image": "gemini-3-pro-image-preview",
    "vision": "gemini-2.5-flash",  # Validation visuelle (tenue, accessoires, action, décor)
    "video": "fal-ai/minimax/hailuo-02/standard/image-to-video",
}

PROMPT_STRICT_PREFIX = ""
PROMPT_STRICT_SUFFIX = ""

# =============================================================================
# ÉTAPES À EXÉCUTER
# =============================================================================

STEPS = {
    "extract_dream_elements": True,
    "analyze_character": True,
    "generate_palette": False,
    "generate_scenario": True,   # Régénérer scénario avec D+E
    "generate_scenes": False,
    "generate_keyframes": True,
    "validate_keyframes": True,
    "generate_videos": True,
    "generate_montage": True,
}

DRY_RUN = False
VERBOSE = True

KEYFRAMES_DIR = None
VIDEOS_DIR = None
SCENARIO_JSON = None  # Pas de scénario existant — régénérer

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
        "nb_scenes_avant": NB_SCENES_AVANT,
        "duree_scene": 6,
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
        "face_validation": {
            "tolerance": 0.3,
            "threshold": 0.8,
        },
        # Tolérance faciale adaptée au type de plan
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
        # V7 config
        "validation": {
            "enable_v1": True,
            "enable_v2": True,
            "enable_v3": True,
            "score_min_pass": 0.8,
        },
        "llm": {
            "max_retries": 3,
            "timeout": 120,
            "temperature_generation": 0.7,
            "temperature_validation": 0.2,
        },
        "costs": {
            "video_per_second": 0.045,
            "scenario_input_per_1k": 0.005,
            "scenario_output_per_1k": 0.015,
            "validation_input_per_1k": 0.00015,
            "validation_output_per_1k": 0.0006,
        },
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

    if results.get("final_video_avant"):
        print(f"\n🎬 Montage AVANT: {results['final_video_avant']}")
    if results.get("final_video_apres"):
        print(f"🎬 Montage APRÈS: {results['final_video_apres']}")
    if results.get("final_video"):
        print(f"🎬 Vidéo finale: {results['final_video']}")

    if results.get("costs_real"):
        print(f"\n💰 COÛTS RÉELS:")
        for service, cost in results["costs_real"].items():
            print(f"   - {service}: {cost:.4f}€")
        print(f"   TOTAL: {sum(results['costs_real'].values()):.4f}€")

    sys.exit(0 if results.get("success") else 1)
