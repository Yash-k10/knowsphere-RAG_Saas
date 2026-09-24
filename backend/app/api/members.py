import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.database import get_db
from app.core.dependencies import (
    get_current_tenant_context,
    require_admin_or_owner,
    TenantContext
)
from app.models.user import User
from app.models.tenant import TenantMember, TenantRole
from app.schemas.tenant import (
    TenantMemberResponse,
    MemberInviteRequest,
    RoleUpdateRequest
)

router = APIRouter(prefix="/members", tags=["Organization Members"])

@router.get("", response_model=List[TenantMemberResponse])
async def list_members(
    ctx: TenantContext = Depends(get_current_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """Lists all members of the current workspace."""
    stmt = (
        select(TenantMember)
        .options(selectinload(TenantMember.user))
        .where(TenantMember.tenant_id == ctx.tenant_id)
        .order_by(TenantMember.created_at.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("", response_model=TenantMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_member(
    req: MemberInviteRequest,
    ctx: TenantContext = Depends(require_admin_or_owner),
    db: AsyncSession = Depends(get_db)
):
    """
    Invites an existing user to this workspace by email.
    Restricted to ADMIN and OWNER roles.
    """
    # Find user by email
    user_stmt = select(User).where(User.email == req.email.lower().strip())
    res_user = await db.execute(user_stmt)
    target_user = res_user.scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No registered user found with email '{req.email}'."
        )

    # Check if already a member
    mem_stmt = select(TenantMember).where(
        TenantMember.tenant_id == ctx.tenant_id,
        TenantMember.user_id == target_user.id
    )
    existing = await db.execute(mem_stmt)
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this organization."
        )

    new_member = TenantMember(
        tenant_id=ctx.tenant_id,
        user_id=target_user.id,
        role=req.role
    )
    db.add(new_member)
    await db.commit()
    await db.refresh(new_member)

    # Reload with user relation
    loaded_stmt = select(TenantMember).options(selectinload(TenantMember.user)).where(TenantMember.id == new_member.id)
    loaded_res = await db.execute(loaded_stmt)
    return loaded_res.scalar_one()

@router.patch("/{member_id}", response_model=TenantMemberResponse)
async def update_member_role(
    member_id: uuid.UUID,
    req: RoleUpdateRequest,
    ctx: TenantContext = Depends(require_admin_or_owner),
    db: AsyncSession = Depends(get_db)
):
    """Updates member role (OWNER or ADMIN required)."""
    stmt = (
        select(TenantMember)
        .options(selectinload(TenantMember.user))
        .where(
            TenantMember.id == member_id,
            TenantMember.tenant_id == ctx.tenant_id
        )
    )
    res = await db.execute(stmt)
    member = res.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    # Prevent demoting the last OWNER
    if member.role == TenantRole.OWNER and req.role != TenantRole.OWNER:
        owner_count_res = await db.execute(
            select(TenantMember).where(
                TenantMember.tenant_id == ctx.tenant_id,
                TenantMember.role == TenantRole.OWNER
            )
        )
        if len(owner_count_res.scalars().all()) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change role: Organization must have at least one OWNER."
            )

    member.role = req.role
    await db.commit()
    await db.refresh(member)
    return member

@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    member_id: uuid.UUID,
    ctx: TenantContext = Depends(require_admin_or_owner),
    db: AsyncSession = Depends(get_db)
):
    """Removes a member from the workspace."""
    stmt = select(TenantMember).where(
        TenantMember.id == member_id,
        TenantMember.tenant_id == ctx.tenant_id
    )
    res = await db.execute(stmt)
    member = res.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if member.user_id == ctx.user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove yourself from organization")

    await db.delete(member)
    await db.commit()
    return None
