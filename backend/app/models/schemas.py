from pydantic import BaseModel, Field
from typing import List, Optional

class AuthRegisterIn(BaseModel):
    email: str
    birthDate: str
    gender: str
    invitationCode: str | None = None

class MagicLinkIn(BaseModel):
    email: str

class VerifyIn(BaseModel):
    token: str

class PhotoVerifyIn(BaseModel):
    photoIds: List[str]

class DreamCreateIn(BaseModel):
    description: str
    reject: List[str] = Field(default_factory=list)
    style: str = "cinematic_soft"
    photoIds: List[str] = Field(default_factory=list)
    decorPhotoIds: List[str] = Field(default_factory=list)

class DreamUpdateIn(BaseModel):
    description: Optional[str] = None
    reject: Optional[List[str]] = None
    style: Optional[str] = None

class GenerateIn(BaseModel):
    subliminalEnabled: bool = False
