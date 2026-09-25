import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from app.db.database import get_db
from app.core.dependencies import get_current_tenant_context, TenantContext
from app.models.chat import Conversation, Message, MessageRole
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationResponse,
    MessageResponse,
    SourceCitation
)
from app.services.rag_service import RAGService

router = APIRouter(tags=["Chat & Conversations"])

@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    ctx: TenantContext = Depends(get_current_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Executes the tenant-isolated RAG pipeline:
    1. Validates or creates conversation scoped to tenant and user.
    2. Records the user question.
    3. Runs semantic vector retrieval against current tenant's chunks ONLY.
    4. Passes context to LLM provider for synthesis.
    5. Saves and returns grounded answer and source citations.
    """
    conversation: Conversation | None = None

    if req.conversation_id:
        stmt = select(Conversation).where(
            Conversation.id == req.conversation_id,
            Conversation.tenant_id == ctx.tenant_id,
            Conversation.user_id == ctx.user.id
        )
        res = await db.execute(stmt)
        conversation = res.scalar_one_or_none()
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found in this organization"
            )
    else:
        # Generate dynamic title from first few words of the question
        title = req.message.strip().split("\n")[0][:45]
        if len(req.message) > 45:
            title += "..."

        conversation = Conversation(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user.id,
            title=title
        )
        db.add(conversation)
        await db.flush()

    # Save user message
    user_msg = Message(
        conversation_id=conversation.id,
        tenant_id=ctx.tenant_id,
        role=MessageRole.USER,
        content=req.message,
        sources_meta=None
    )
    db.add(user_msg)
    await db.flush()

    # Execute RAG pipeline
    rag_result = await RAGService.answer_query(
        db=db,
        tenant_id=ctx.tenant_id,
        query=req.message
    )

    # Save assistant message with citations
    sources_dict_list = [s.model_dump() for s in rag_result.sources]
    asst_msg = Message(
        conversation_id=conversation.id,
        tenant_id=ctx.tenant_id,
        role=MessageRole.ASSISTANT,
        content=rag_result.answer,
        sources_meta=sources_dict_list
    )
    db.add(asst_msg)
    await db.commit()
    await db.refresh(asst_msg)

    return ChatResponse(
        conversation_id=conversation.id,
        answer=rag_result.answer,
        sources=rag_result.sources,
        message_id=asst_msg.id
    )

@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    ctx: TenantContext = Depends(get_current_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """Lists conversations for the authenticated user within their active workspace."""
    stmt = (
        select(Conversation)
        .where(
            Conversation.tenant_id == ctx.tenant_id,
            Conversation.user_id == ctx.user.id
        )
        .order_by(desc(Conversation.created_at))
    )
    res = await db.execute(stmt)
    convs = res.scalars().all()
    return convs

@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: uuid.UUID,
    ctx: TenantContext = Depends(get_current_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves full conversation history with message citations, strictly scoped."""
    stmt = (
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(
            Conversation.id == conversation_id,
            Conversation.tenant_id == ctx.tenant_id,
            Conversation.user_id == ctx.user.id
        )
    )
    res = await db.execute(stmt)
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or unauthorized"
        )
    return conv

@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: uuid.UUID,
    ctx: TenantContext = Depends(get_current_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """Deletes a conversation and its messages."""
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.tenant_id == ctx.tenant_id,
        Conversation.user_id == ctx.user.id
    )
    res = await db.execute(stmt)
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    await db.delete(conv)
    await db.commit()
    return None
