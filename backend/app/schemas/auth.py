"""
Pydantic schemas for User Authentication and Profiles.
"""

from pydantic import BaseModel, EmailStr
from typing import Optional


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserProfile"


class UserProfile(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str
    customer_id: Optional[int]

    class Config:
        from_attributes = True
