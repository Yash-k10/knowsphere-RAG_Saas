import uuid
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from app.models.tenant import TenantRole
from app.schemas.user import UserResponse

class TenantCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)

class TenantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    join_code: str | None = None
    created_at: datetime
    role: TenantRole | None = None

class JoinWorkspaceRequest(BaseModel):
    join_code: str = Field(..., min_length=4, max_length=32, description="Unique workspace invite/join code")

class MemberInviteRequest(BaseModel):
    email: str
    role: TenantRole = TenantRole.MEMBER

class RoleUpdateRequest(BaseModel):
    role: TenantRole

class TenantMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    role: TenantRole
    created_at: datetime
    user: UserResponse

class DashboardStats(BaseModel):
    tenant_name: str
    total_documents: int
    total_members: int
    total_conversations: int
    total_chunks: int
    documents_processing: int
