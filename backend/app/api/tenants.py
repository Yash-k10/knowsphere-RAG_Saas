import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.database import get_db
from app.core.dependencies import get_current_user, get_current_tenant_context, TenantContext
from app.models.user import User
from app.models.tenant import Tenant, TenantMember, TenantRole
from app.models.document import Document, DocumentStatus
from app.models.chunk import DocumentChunk
from app.models.chat import Conversation
from app.schemas.tenant import TenantCreate, TenantResponse, DashboardStats, JoinWorkspaceRequest

router = APIRouter(prefix="/tenants", tags=["Tenants"])

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s_-]+", "-", text)

@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    req: TenantCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Creates a new isolated organization/tenant workspace and grants caller OWNER role."""
    base_slug = slugify(req.name)
    slug = f"{base_slug}-{str(current_user.id)[:6]}"

    # Check collision
    existing = await db.execute(select(Tenant).where(Tenant.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{str(current_user.id)[6:10]}"

    tenant = Tenant(name=req.name, slug=slug)
    db.add(tenant)
    await db.flush()

    member = TenantMember(
        tenant_id=tenant.id,
        user_id=current_user.id,
        role=TenantRole.OWNER
    )
    db.add(member)
    await db.commit()
    await db.refresh(tenant)

    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        join_code=tenant.join_code,
        created_at=tenant.created_at,
        role=TenantRole.OWNER
    )

@router.post("/join", response_model=TenantResponse)
async def join_tenant_by_code(
    req: JoinWorkspaceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Allows an authenticated user to join an existing organization workspace using its unique join code."""
    clean_code = req.join_code.strip().upper()
    stmt = select(Tenant).where(Tenant.join_code == clean_code)
    res = await db.execute(stmt)
    tenant = res.scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No workspace found with invite code '{clean_code}'."
        )

    # Check if already a member
    existing = await db.execute(
        select(TenantMember).where(
            TenantMember.tenant_id == tenant.id,
            TenantMember.user_id == current_user.id
        )
    )
    mem = existing.scalar_one_or_none()
    if mem:
        return TenantResponse(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            join_code=tenant.join_code,
            created_at=tenant.created_at,
            role=mem.role
        )

    new_member = TenantMember(
        tenant_id=tenant.id,
        user_id=current_user.id,
        role=TenantRole.MEMBER
    )
    db.add(new_member)
    await db.commit()

    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        join_code=tenant.join_code,
        created_at=tenant.created_at,
        role=TenantRole.MEMBER
    )

@router.get("/current", response_model=TenantResponse)
async def get_current_tenant(
    ctx: TenantContext = Depends(get_current_tenant_context)
):
    """Returns the details and role within the actively authorized workspace."""
    return TenantResponse(
        id=ctx.tenant.id,
        name=ctx.tenant.name,
        slug=ctx.tenant.slug,
        join_code=ctx.tenant.join_code,
        created_at=ctx.tenant.created_at,
        role=ctx.role
    )

@router.get("/dashboard", response_model=DashboardStats)
async def get_tenant_dashboard(
    ctx: TenantContext = Depends(get_current_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """Returns key analytics and ingestion metrics strictly scoped to the authorized tenant."""
    tenant_id = ctx.tenant_id

    # Total Documents
    docs_res = await db.execute(
        select(func.count(Document.id)).where(Document.tenant_id == tenant_id)
    )
    total_docs = docs_res.scalar() or 0

    # Total Members
    members_res = await db.execute(
        select(func.count(TenantMember.id)).where(TenantMember.tenant_id == tenant_id)
    )
    total_members = members_res.scalar() or 0

    # Total Conversations
    convs_res = await db.execute(
        select(func.count(Conversation.id)).where(Conversation.tenant_id == tenant_id)
    )
    total_convs = convs_res.scalar() or 0

    # Total Chunks
    chunks_res = await db.execute(
        select(func.count(DocumentChunk.id)).where(DocumentChunk.tenant_id == tenant_id)
    )
    total_chunks = chunks_res.scalar() or 0

    # Processing Documents
    proc_res = await db.execute(
        select(func.count(Document.id)).where(
            Document.tenant_id == tenant_id,
            Document.processing_status.in_([DocumentStatus.UPLOADING, DocumentStatus.PROCESSING])
        )
    )
    docs_processing = proc_res.scalar() or 0

    return DashboardStats(
        tenant_name=ctx.tenant.name,
        total_documents=total_docs,
        total_members=total_members,
        total_conversations=total_convs,
        total_chunks=total_chunks,
        documents_processing=docs_processing
    )
