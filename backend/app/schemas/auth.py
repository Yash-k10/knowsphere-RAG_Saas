from pydantic import BaseModel, EmailStr, Field

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: str | None = None
    exp: int | None = None

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    organization_name: str | None = Field(default=None, min_length=2, max_length=100, description="Optional organization name to auto-create tenant on registration")
    join_code: str | None = Field(default=None, min_length=4, max_length=32, description="Optional unique workspace code to join an existing company")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
