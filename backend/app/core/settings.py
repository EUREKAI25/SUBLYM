import os
from pydantic import BaseModel

class Settings(BaseModel):
    app_name: str = "Sublym MVP API"
    jwt_secret: str = os.getenv("SUBLYM_JWT_SECRET", "dev_secret_change_me")
    storage_root: str = os.getenv("SUBLYM_STORAGE_ROOT", os.path.join(os.path.dirname(__file__), "..", "..", "storage"))
    constraints_path: str = os.getenv("SUBLYM_CONSTRAINTS_PATH", os.path.join(os.path.dirname(__file__), "..", "..", "config", "constraints.txt"))
    howto_dir: str = os.getenv("SUBLYM_HOWTO_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "how_to"))

settings = Settings()
