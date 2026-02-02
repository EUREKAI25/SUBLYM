"""
Sublym v4 - Environment loader
"""

import os
from pathlib import Path


def load_env():
    """Charge les variables d'environnement depuis .env"""
    env_paths = [
        Path(".env"),
        Path(__file__).parent.parent / ".env",
        Path.home() / ".env",
    ]
    
    for env_path in env_paths:
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, value = line.split("=", 1)
                        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
            break


def get_api_key(name: str) -> str:
    """Récupère une clé API depuis l'environnement."""
    load_env()
    key = os.environ.get(name)
    if not key:
        raise ValueError(f"{name} not found in environment")
    return key
