import re
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.tenant import Tenant, TenantMember, TenantRole
from app.schemas.auth import RegisterRequest, Token
from app.schemas.user import UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s_-]+", "-", text)

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Registers a new user and creates an initial organization workspace."""
    # Check if user already exists
    existing = await db.execute(select(User).where(User.email == req.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    # Create User
    new_user = User(
        name=req.name,
        email=req.email.lower(),
        password_hash=get_password_hash(req.password),
        is_active=True
    )
    db.add(new_user)
    await db.flush()

    # Create Default Workspace / Tenant
    org_name = req.organization_name or f"{req.name.split()[0]}'s Workspace"
    base_slug = slugify(org_name)
    slug = f"{base_slug}-{str(new_user.id)[:6]}"

    tenant = Tenant(
        name=org_name,
        slug=slug
    )
    db.add(tenant)
    await db.flush()

    # Assign user as OWNER of this workspace
    member = TenantMember(
        tenant_id=tenant.id,
        user_id=new_user.id,
        role=TenantRole.OWNER
    )
    db.add(member)
    await db.commit()
    await db.refresh(new_user)

    # Generate JWT
    token = create_access_token(subject=str(new_user.id))
    return Token(access_token=token, token_type="bearer")

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Authenticates username (email) and password, returning a JWT token."""
    email = form_data.username.lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive."
        )

    token = create_access_token(subject=str(user.id))
    return Token(access_token=token, token_type="bearer")

@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns profile and authorized tenant workspaces for current user."""
    stmt = (
        select(TenantMember, Tenant)
        .join(Tenant, Tenant.id == TenantMember.tenant_id)
        .where(TenantMember.user_id == current_user.id)
    )
    res = await db.execute(stmt)
    workspaces = []
    for member, tenant in res.all():
        workspaces.append({
            "id": str(tenant.id),
            "name": tenant.name,
            "slug": tenant.slug,
            "role": member.role.value
        })

    return {
        "user": {
            "id": str(current_user.id),
            "name": current_user.name,
            "email": current_user.email,
            "created_at": current_user.created_at
        },
        "workspaces": workspaces
    }
