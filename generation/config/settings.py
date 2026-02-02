"""
Sublym v4 - Configuration par défaut
VERSION MISE À JOUR - Février 2026
"""

# =============================================================================
# PRESETS D'ÉTAPES
# =============================================================================

PRESETS = {
    "full": {
        "extract_dream_elements": True,  # NOUVELLE ÉTAPE
        "analyze_character": True,
        "generate_palette": True,
        "generate_scenario": True,
        "generate_scenes": True,
        "generate_keyframes": True,
        "validate_keyframes": True,
        "generate_videos": True,
        "generate_montage": True,
    },
    "scenario_only": {
        "extract_dream_elements": True,
        "analyze_character": True,
        "generate_palette": True,
        "generate_scenario": True,
        "generate_scenes": True,
        "generate_keyframes": False,
        "validate_keyframes": False,
        "generate_videos": False,
        "generate_montage": False,
    },
    "keyframes_only": {
        "extract_dream_elements": True,
        "analyze_character": True,
        "generate_palette": True,
        "generate_scenario": True,
        "generate_scenes": True,
        "generate_keyframes": True,
        "validate_keyframes": True,
        "generate_videos": False,
        "generate_montage": False,
    },
    "videos_from_keyframes": {
        "extract_dream_elements": False,
        "analyze_character": False,
        "generate_palette": False,
        "generate_scenario": False,
        "generate_scenes": False,
        "generate_keyframes": False,
        "validate_keyframes": False,
        "generate_videos": True,
        "generate_montage": True,
    },
    "montage_only": {
        "extract_dream_elements": False,
        "analyze_character": False,
        "generate_palette": False,
        "generate_scenario": False,
        "generate_scenes": False,
        "generate_keyframes": False,
        "validate_keyframes": False,
        "generate_videos": False,
        "generate_montage": True,
    },
    "scenario_pub": {
        "extract_dream_elements": True,
        "analyze_character": True,
        "generate_palette": True,
        "generate_scenario": True,
        "generate_scenes": True,
        "generate_keyframes": True,
        "validate_keyframes": True,
        "generate_videos": True,
        "generate_montage": True,
    },
}


# =============================================================================
# VALEURS PAR DÉFAUT
# =============================================================================

DEFAULT_CONFIG = {
    # Scènes
    "nb_scenes": 6,
    "nb_pov_scenes": 1,
    "mode": "scenario",  # "scenario", "free_scenes", ou "scenario_pub"
    "imposed_scenes": None,
    "daily_context": "",  # Mode scenario_pub : description du quotidien ennuyeux
    "custom_palette": None,
    "palette_complement_skin": True,

    # Prompts
    "prompt_strict_prefix": "",
    "prompt_strict_suffix": "",

    # Shooting
    "shot_types": ["close_up", "medium", "medium_full", "full", "wide"],
    "camera_angles": ["eye_level", "low_angle", "high_angle"],
    "camera_movements": ["static", "slow_pan_left", "slow_pan_right", "slow_zoom_in", "slow_zoom_out", "tracking"],
    "lighting_directions": ["front", "side", "back", "rim"],
    "lighting_temperatures": ["warm", "neutral", "cool"],
    "depth_of_field_options": ["shallow", "medium", "deep"],
    "focus_options": ["face", "eyes", "full_body", "foreground_object"],

    # Acting
    "expression_intensities": ["subtle", "moderate", "pronounced"],
    "gaze_directions": ["away_left", "away_right", "down", "up", "distant", "at_object"],

    # Validation
    "global_min_score": 0.75,
    "max_attempts": 5,
    "max_video_attempts": 4,
    "validation_config": {
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
    },

    # Critères additionnels pour le mode scenario_pub (scènes de transition)
    "validation_config_pub_transition": {
        "no_scifi_effect": {
            "min": 0.95, "ref": "none",
            "label": "NO sci-fi effects: no portal, no magic, no light rays, no particles, no morphing. The transition is a cinematic CUT, NOT a special effect."
        },
        "no_caricature": {
            "min": 0.9, "ref": "none",
            "label": "NO caricature: image must be photorealistic and credible. No unrealistic colors, no impossible fantasy setting, no supernatural lighting."
        },
        "natural_surprise": {
            "min": 0.85, "ref": "none",
            "label": "NATURAL surprise: the wonder reaction must be that of a real person. No exaggerated wide-open mouth, no cartoon bulging eyes. A slight step back, raised eyebrows, slightly open mouth = OK."
        },
        "genuine_happiness": {
            "min": 0.85, "ref": "none",
            "label": "GENUINE happiness: the smile and joy must appear sincere and spontaneous. No forced, frozen, or toothpaste-commercial smile. A real smile reaches the eyes (Duchenne smile)."
        },
        "daily_scene_mundane": {
            "min": 0.85, "ref": "pitch",
            "label": "CREDIBLE daily scene: the daily setting (start 1A) must be a real recognizable mundane place (office, transport, kitchen...), not an already stylized or aestheticized location."
        },
        "palette_contrast_visible": {
            "min": 0.8, "ref": "none",
            "label": "VISIBLE palette contrast: if scene 1A, start must be clearly desaturated/dull and end clearly colorful/luminous. The difference must be striking."
        },
        "emotion_arc_coherent": {
            "min": 0.8, "ref": "pitch",
            "label": "COHERENT emotional arc: character expression must match the arc moment (weariness for start 1A, wonder for end 1A, joy for 1B)."
        },
    },

    # Validation faciale DeepFace + ArcFace (Gemini Vision désactivé)
    "face_validation": {
        "gemini_min": 0.7,
        "tolerance": 0.4,
        "threshold": 0.8,
    },

    # Modèles
    "models": {
        "scenario": "gpt-4o",
        "image": "gemini-3-pro-image-preview",
        "vision": None,  # Désactivé: DeepFace + ArcFace suffisent
        "video": "fal-ai/minimax/hailuo-02/standard/image-to-video",
    },

    # Couts par provider (USD)
    "costs": {
        "video_per_second": 0.045,  # Hailuo 02 Standard
        "scenario_input_per_1k": 0.005,  # GPT-4o input
        "scenario_output_per_1k": 0.015,  # GPT-4o output
    },
}

# Raccourci pour import depuis les services
DEFAULT_MODELS = DEFAULT_CONFIG["models"]


# =============================================================================
# TYPES DE SCÈNES
# =============================================================================

SCENE_TYPES = {
    "ACTION": {
        "description": "Le personnage FAIT quelque chose de visible et dynamique",
        "min_ratio": 0.5,
        "max_ratio": 0.7,
        "examples": ["marche", "travaille", "cuisine", "joue musique", "écrit"]
    },
    "INTERACTION": {
        "description": "Échange avec quelqu'un (Character B, animal, commerçant)",
        "min_ratio": 0,
        "max_ratio": 0.3,
        "examples": ["discussion", "collaboration", "moment partagé"]
    },
    "IMMERSION": {
        "description": "Découverte d'un lieu, absorption dans l'environnement",
        "min_ratio": 0,
        "max_ratio": 0.3,
        "examples": ["arrive dans un lieu", "observe paysage", "explore"]
    },
    "INTROSPECTION": {
        "description": "Moment de réflexion, contemplation (à utiliser avec modération)",
        "min_ratio": 0,
        "max_ratio": 0.2,
        "examples": ["contemple", "réfléchit", "apprécie"]
    },
    "ACCOMPLISSEMENT": {
        "description": "Réservé à la scène finale - le personnage a réalisé son rêve",
        "min_ratio": 0,
        "max_ratio": 1,  # Toujours 1 seule scène
        "examples": ["satisfaction", "fierté", "regard caméra possible"],
        "allows_camera_look": True
    },
    # Types réservés au mode scenario_pub
    "TRANSITION_AWAKENING": {
        "description": "Le quotidien ennuyeux se transforme en environnement de rêve. Le personnage passe de la lassitude à l'émerveillement.",
        "mode": "scenario_pub",
        "position": "1A",
        "examples": ["bureau gris → atelier lumineux", "file d'attente → plage dorée"],
    },
    "TRANSITION_ACTION": {
        "description": "Suite immédiate de l'éveil : le personnage commence à explorer le monde de rêve.",
        "mode": "scenario_pub",
        "position": "1B",
        "examples": ["premier pas dans le rêve", "découverte émerveillée de l'environnement"],
    },
}
