# config/config.py
"""
SUBLYM - Configuration centrale.
Toutes les variables configurables depuis back-office à terme.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# =============================================================================
# VIDEO SETTINGS
# =============================================================================

VIDEO_TARGET_DURATION = 48  # Durée cible en secondes (minimum 18)

# Contraintes MiniMax
SCENE_DURATION = 6  # Secondes par scène (6s = compatible 1080p, 10s = 768p only)

# Calcul automatique du nombre de scènes
def calculate_nb_scenes(target_duration: int = VIDEO_TARGET_DURATION) -> int:
    """
    Calcule le nombre de scènes pour atteindre la durée cible.
    Minimum 3 scènes (INTRO + 1 middle + OUTRO).
    Maximum 8 scènes.
    """
    min_scenes = 3
    max_scenes = 8
    
    nb = max(min_scenes, target_duration // SCENE_DURATION)
    return min(nb, max_scenes)

# Calculés automatiquement
nb_scenes_video = calculate_nb_scenes()
video_duration_total_sec = nb_scenes_video * SCENE_DURATION

# =============================================================================
# IMAGE GENERATION
# =============================================================================

IMAGE_PROVIDER = os.getenv("IMAGE_PROVIDER", "gemini-3-pro")  # flux, gemini-flash, gemini-3-pro, imagen

IMAGE_VARIANTS_COUNT = 1      # Nombre de variantes par keyframe
IMAGE_MIN_SCORE = 7.0         # Score minimum pour accepter une image
IMAGE_MAX_ATTEMPTS = 5        # Nombre max de tentatives si score insuffisant (stoppe si non atteint)

# Providers disponibles
IMAGE_PROVIDERS = {
    "flux": {
        "model": "black-forest-labs/flux-1.1-pro",
        "cost_per_image": 0.04,
    },
    "gemini-flash": {
        "model": "gemini-2.5-flash-image",
        "cost_per_image": 0.02,
    },
    "gemini-3-pro": {
        "model": "gemini-3-pro-image-preview", 
        "cost_per_image": 0.18,
    },
    "imagen": {
        "model": "imagen-4.0-generate-001",
        "cost_per_image": 0.03,
    },
}

# =============================================================================
# VIDEO GENERATION
# =============================================================================

VIDEO_PROVIDER = os.getenv("VIDEO_PROVIDER", "minimax")

VIDEO_PROVIDERS = {
    "minimax": {
        "model": "MiniMax-Hailuo-2.3",
        "cost_per_second": 0.045,  # ~0.27€ pour 6s
        "duration_options": [6, 10],  # 10s = 768p only
        "resolution": "1080P",
    },
}

# =============================================================================
# TEXT GENERATION (GPT)
# =============================================================================

TEXT_PROVIDER = os.getenv("TEXT_PROVIDER", "openai")
TEXT_MODEL = os.getenv("TEXT_MODEL", "gpt-4o")

# =============================================================================
# SCENARIO STRUCTURE
# =============================================================================

# Types de scènes (ordre fixe pour INTRO et OUTRO, random pour le milieu)
SCENE_TYPES = ["INTRO", "ICONIC", "INTROSPECTIVE", "ACTION", "OUTRO"]

# Probabilité d'interaction caméra dans l'OUTRO (crée le "manque" si non)
OUTRO_INTERACTION_PROBABILITY = 0.7

# Positions possibles pour le CUT (entre scènes)
CUT_POSITIONS = [2, 3, 4]

# =============================================================================
# PROMPTS & LIMITS
# =============================================================================

# Limites texte rêve (pour frontend)
DREAM_TEXT_MIN_CHARS = 20
DREAM_TEXT_MAX_CHARS = 300

# Limites photos identité (pour frontend)  
IDENTITY_PHOTOS_MIN = 3
IDENTITY_PHOTOS_MAX = 5

# =============================================================================
# SHOOTING ANGLES (legacy, pour compatibilité)
# =============================================================================

start_shooting_angle_bank_choices_number = 3
end_shooting_angle_bank_choices_number = 3
casual_shooting_angle_bank_choices_number = 5

shooting_angle_options = [
    "Wide shot", "Medium shot", "Close-up", "Over-the-shoulder",
    "Low angle", "High angle", "Dutch angle", "POV shot",
    "Tracking shot", "Pan left", "Pan right", "Zoom in", "Static shot"
]

# =============================================================================
# PATHS
# =============================================================================

OUTPUT_DIR = os.getenv("OUTPUT_DIR", "outputs")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

# =============================================================================
# API KEYS (loaded from .env)
# =============================================================================

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN")
MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY")
FAL_KEY = os.getenv("FAL_KEY")

# =============================================================================
# DEBUG / LOGGING
# =============================================================================

DEBUG = os.getenv("DEBUG", "false").lower() == "true"
LOG_COSTS = True  # Tracker les coûts de chaque appel API

# =============================================================================
# PRINT CONFIG ON LOAD (debug)
# =============================================================================

if DEBUG:
    print(f"[CONFIG] VIDEO_TARGET_DURATION: {VIDEO_TARGET_DURATION}s")
    print(f"[CONFIG] SCENE_DURATION: {SCENE_DURATION}s")
    print(f"[CONFIG] nb_scenes_video: {nb_scenes_video}")
    print(f"[CONFIG] video_duration_total_sec: {video_duration_total_sec}s")
    print(f"[CONFIG] IMAGE_PROVIDER: {IMAGE_PROVIDER}")
    print(f"[CONFIG] VIDEO_PROVIDER: {VIDEO_PROVIDER}")

# =============================================================================
# FILE VALIDATION
# =============================================================================

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
MAX_BYTES = 10 * 1024 * 1024  # 10 MB max par photo
