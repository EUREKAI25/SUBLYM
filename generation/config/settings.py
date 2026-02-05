"""
Sublym v4 - Configuration par défaut
VERSION MISE À JOUR - Février 2026
- Scenario Agent v7: 11 étapes avec validation
"""

# =============================================================================
# RÈGLES DE PRODUCTION VIDÉO (par catégorie)
# =============================================================================

RULES_TECHNIQUE = """\
- Mouvements lents à modérés (l'IA génère des artefacts sur mouvements rapides)
- Pas de rotation caméra rapide
- Éviter les foules denses
- Max 2 personnages principaux par plan
- Pas de texte lisible dans le cadre
- Éviter reflets complexes (miroirs, eau agitée)
- Préférer éclairage naturel diffus"""

RULES_PERSONNAGES = """\
- Pas de demi-tour des personnages
- Expressions positives uniquement (joie, tendresse, émerveillement, complicité)
- JAMAIS d'air triste, inquiet, effrayé, en colère
- Figurants floutés / hors focus (seuls protagonistes nets)
- Pas de gros plan visage (révèle l'artifice IA)
- Vue de dos = brève uniquement, jamais scène entière
- Pas de dos prolongé à la caméra
- Expressions faciales naturelles, pas exagérées
- Contact visuel entre personnages = connexion
- Gestes cohérents avec l'émotion
- Proximité physique progressive (romance)
- Personnages normaux, pas hollywoodiens (réalisme et identification)
- Style vestimentaire adapté au lieu et à l'activité (crédibilité)"""

RULES_CADRAGE = """\
Plans autorisés:
- Plan d'ensemble (extreme wide): établir le lieu
- Plan large (wide): action dans l'environnement
- Plan moyen (medium): dialogue, interaction
- Plan américain (cowboy): personnage en action
- Plan rapproché poitrine (medium close-up): émotion sans gros plan visage
- PAS de gros plan visage, PAS de très gros plan

Mouvements caméra autorisés:
- Fixe: stabilité, contemplation
- Travelling avant lent: entrer dans l'intimité
- Travelling arrière lent: révéler le contexte
- Travelling latéral lent: accompagner le mouvement
- Panoramique lent: découverte du lieu
- Léger mouvement (handheld subtle): authenticité

Angles:
- Niveau des yeux: neutre, identification
- Légère plongée: vulnérabilité, tendresse
- Légère contre-plongée: puissance, admiration"""

RULES_NARRATIVES = """\
- Chaque scène a un objectif émotionnel clair
- Progression d'intensité émotionnelle
- Scène finale = accomplissement visible
- Pas de scène sans lien avec l'objectif du rêve
- Transitions logiques (lieu/temps)"""

RULES_COHERENCE = """\
- Palette couleurs cohérente sur toute la vidéo
- Tenues vestimentaires cohérentes dans le temps
- Éclairage cohérent avec l'heure indiquée
- Météo constante sauf indication contraire"""

RULES_RYTHME = """\
- Répartition durée à discrétion (±20% par scène)
- Scène d'ouverture peut être plus longue (immersion)
- Scène finale peut être plus longue (impact)
- Pas de scène < 4s
- Pas d'action statique > 3s"""

RULES_FORMAT = """\
- Style descriptif neutre, 3ème personne
- JAMAIS de "vous", "Visualisez-vous", "Imaginez"
- Descriptions factuelles et précises
- Pas de répétition entre scènes"""

PRODUCTION_RULES_BY_CATEGORY = {
    "technique": RULES_TECHNIQUE,
    "personnages": RULES_PERSONNAGES,
    "cadrage": RULES_CADRAGE,
    "narratives": RULES_NARRATIVES,
    "coherence": RULES_COHERENCE,
    "rythme": RULES_RYTHME,
    "format": RULES_FORMAT,
}


def get_rules(*categories: str) -> str:
    """Retourne les règles combinées pour les catégories spécifiées.

    Usage: get_rules("technique", "personnages", "format")
    """
    parts = []
    for cat in categories:
        text = PRODUCTION_RULES_BY_CATEGORY.get(cat, "")
        if text:
            parts.append(f"## {cat.upper()}\n{text}")
    if not parts:
        return ""
    return "RÈGLES DE PRODUCTION:\n\n" + "\n\n".join(parts)


# Full rules (rétrocompatibilité)
PRODUCTION_RULES = get_rules(*PRODUCTION_RULES_BY_CATEGORY.keys())


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
    "duree_scene": 6,  # secondes par scène
    "nb_pov_scenes": 1,
    "mode": "scenario",  # "scenario", "free_scenes", ou "scenario_pub"
    "imposed_scenes": None,
    "daily_context": "",  # Mode scenario_pub : description du quotidien ennuyeux
    "nb_scenes_avant": 1,  # Mode scenario_pub : nb de scènes quotidien avant le switch
    "custom_palette": None,
    "palette_complement_skin": True,

    # Prompts
    "prompt_strict_prefix": "",
    "prompt_strict_suffix": "",

    # Shooting
    "shot_types": ["close_up", "medium", "medium_full", "full", "wide", "profile", "back_three_quarter", "far"],
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

    # Critères additionnels pour le mode scenario_pub (scènes quotidien)
    "validation_config_pub_transition": {
        "no_scifi_effect": {
            "min": 0.95, "ref": "none",
            "label": "NO sci-fi effects: no portal, no magic, no light rays, no particles, no morphing."
        },
        "no_caricature": {
            "min": 0.9, "ref": "none",
            "label": "NO caricature: image must be photorealistic and credible. No unrealistic colors, no supernatural lighting."
        },
        "daily_scene_mundane": {
            "min": 0.85, "ref": "pitch",
            "label": "CREDIBLE daily scene: must be a real recognizable mundane place (office, transport, kitchen...)."
        },
        "emotion_arc_coherent": {
            "min": 0.8, "ref": "pitch",
            "label": "COHERENT emotional arc: character expression must match the scene moment."
        },
    },

    # Critères de validation pour le SWITCH décor (Gemini background swap)
    "validation_config_pub_switch": {
        "face_identical": {
            "min": 0.95, "ref": "source_image",
            "label": "Face IDENTICAL to source image: same person, same features, same expression"
        },
        "pose_identical": {
            "min": 0.9, "ref": "source_image",
            "label": "Body position IDENTICAL: same orientation, same arm/hand positions, same posture"
        },
        "clothing_identical": {
            "min": 0.9, "ref": "source_image",
            "label": "Clothing IDENTICAL: same outfit, same colors, same patterns"
        },
        "hair_identical": {
            "min": 0.9, "ref": "source_image",
            "label": "Hair IDENTICAL: same length, same style, same color"
        },
        "environment_changed": {
            "min": 0.85, "ref": "none",
            "label": "Environment COMPLETELY different from original: new setting, new background, new lighting"
        },
        "environment_matches_dream": {
            "min": 0.8, "ref": "pitch",
            "label": "New environment matches the dream description"
        },
        "no_scifi_effect": {
            "min": 0.95, "ref": "none",
            "label": "NO sci-fi effects: no portal, no particles, no morphing, no magic light"
        },
        "realistic_lighting": {
            "min": 0.85, "ref": "none",
            "label": "Realistic lighting coherent with the new location"
        },
    },

    # Validation faciale biométrique : DeepFace + ArcFace uniquement
    "face_validation": {
        "tolerance": 0.3,
        "threshold": 0.8,
    },

    # Tolérance faciale adaptée au type de plan
    # None = skip face validation (visage non visible)
    "face_tolerance_by_shot": {
        "close_up": 0.2,            # Visage = sujet principal, strict
        "medium": 0.3,              # Standard (défaut)
        "medium_full": 0.4,         # Visage plus petit
        "full": 0.5,                # Plan pied, visage petit
        "wide": 0.6,                # Plan large, visage très petit
        "far": 0.6,                 # Très lointain
        "profile": 0.4,             # Profil, face partielle
        "back_three_quarter": None,  # Dos → pas de validation faciale
    },

    # Modèles
    "models": {
        "scenario": "gpt-4o",
        "scenario_validation": "gpt-4o-mini",  # Modèle moins cher pour V1/V2/V3
        "image": "gemini-3-pro-image-preview",
        "vision": "gemini-2.5-pro",  # Validation visuelle (tenue, accessoires, action, décor)
        "video": "fal-ai/minimax/hailuo-02/standard/image-to-video",
    },

    # Couts par provider (USD)
    "costs": {
        "video_per_second": 0.045,  # Hailuo 02 Standard
        "scenario_input_per_1k": 0.005,  # GPT-4o input
        "scenario_output_per_1k": 0.015,  # GPT-4o output
        "validation_input_per_1k": 0.00015,  # GPT-4o-mini input
        "validation_output_per_1k": 0.0006,  # GPT-4o-mini output
    },
}

# Raccourci pour import depuis les services
DEFAULT_MODELS = DEFAULT_CONFIG["models"]


# =============================================================================
# TYPES DE SCÈNES
# =============================================================================

def get_scene_types(config):
    """Return scene types from external config (database), or hardcoded defaults."""
    return config.get("scene_types", SCENE_TYPES)


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
    "PRE_SWITCH": {
        "description": "Scène quotidien ennuyeux avant le switch Sublym. Palette désaturée, émotions négatives légères.",
        "mode": "scenario_pub",
        "examples": ["bureau morne", "métro bondé", "appartement le soir seul(e)"],
    },
    "DISCOVERY": {
        "description": "Découverte du nouveau décor après le switch. Arc émotionnel atypique: confusion → émerveillement → joie → élan.",
        "mode": "scenario_pub",
        "examples": ["confusion → émerveillement → joie → premier élan"],
    },
    # Legacy (rétrocompatibilité)
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
