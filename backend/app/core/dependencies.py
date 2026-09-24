import uuid
from typing import Annotated
from dataclasses import dataclass
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.models.tenant import Tenant, TenantMember, TenantRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

@dataclass
class TenantContext:
    tenant: Tenant
    member: TenantMember
    user: User

    @property
    def tenant_id(self) -> uuid.UUID:
        return self.tenant.id

    @property
    def role(self) -> TenantRole:
        return self.member.role

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> User:
    """Authenticates JWT token and retrieves the current active user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id_str: str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise credentials_exception

    stmt = select(User).where(User.id == user_id, User.is_active == True)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

async def get_current_tenant_context(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-ID")
) -> TenantContext:
    """
    CRITICAL SECURITY LAYER:
    Resolves the active tenant strictly from database memberships.
    A user can NEVER access data from a tenant they do not belong to.
    """
    target_tenant_id: uuid.UUID | None = None
    if x_tenant_id:
        try:
            target_tenant_id = uuid.UUID(x_tenant_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-Tenant-ID format")

    if target_tenant_id:
        stmt = select(TenantMember).where(
            TenantMember.user_id == current_user.id,
            TenantMember.tenant_id == target_tenant_id
        )
        result = await db.execute(stmt)
        member = result.scalar_one_or_none()
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not an authorized member of this tenant workspace"
            )
    else:
        # Default to user's first available tenant membership
        stmt = select(TenantMember).where(TenantMember.user_id == current_user.id).order_by(TenantMember.created_at.asc())
        result = await db.execute(stmt)
        member = result.scalars().first()
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not belong to any tenant organization yet"
            )

    # Fetch Tenant object
    stmt_tenant = select(Tenant).where(Tenant.id == member.tenant_id)
    res_tenant = await db.execute(stmt_tenant)
    tenant = res_tenant.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant workspace not found")

    return TenantContext(tenant=tenant, member=member, user=current_user)

def require_admin_or_owner(
    context: Annotated[TenantContext, Depends(get_current_tenant_context)]
) -> TenantContext:
    """Restricts access to OWNER and ADMIN roles within the authorized tenant."""
    if context.role not in [TenantRole.OWNER, TenantRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation requires ADMIN or OWNER privileges in this organization"
        )
    return context
