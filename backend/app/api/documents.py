import uuid
import os
import mimetypes
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status, Header
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.db.database import get_db
from app.core.config import settings
from app.core.dependencies import get_current_tenant_context, TenantContext
from app.core.security import decode_access_token
from app.models.user import User
from app.models.tenant import Tenant, TenantMember
from app.models.document import Document, DocumentStatus
from app.models.chunk import DocumentChunk
from app.schemas.document import DocumentResponse
from app.services.ingestion_service import IngestionService

router = APIRouter(prefix="/documents", tags=["Documents"])

async def get_tenant_context_for_file_view(
    token: str | None = None,
    tenant_id: str | None = None,
    authorization: str | None = Header(default=None),
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_db)
) -> TenantContext:
    """
    Resolves authenticated tenant context from either Bearer header or query parameters.
    Allows viewing/streaming documents directly in browser tabs or iframes while maintaining strict multi-tenant isolation.
    """
    raw_token = token
    if not raw_token and authorization:
        if authorization.lower().startswith("bearer "):
            raw_token = authorization[7:].strip()
        else:
            raw_token = authorization.strip()

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required to view document"
        )

    payload = decode_access_token(raw_token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    try:
        user_id = uuid.UUID(payload.get("sub"))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    user_stmt = select(User).where(User.id == user_id, User.is_active == True)
    user = (await db.execute(user_stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    target_tenant_str = tenant_id or x_tenant_id
    target_tenant_id = None
    if target_tenant_str:
        try:
            target_tenant_id = uuid.UUID(target_tenant_str)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tenant ID format")

    if target_tenant_id:
        stmt_mem = select(TenantMember).where(
            TenantMember.user_id == user.id,
            TenantMember.tenant_id == target_tenant_id
        )
        member = (await db.execute(stmt_mem)).scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied for this organization")
    else:
        stmt_mem = select(TenantMember).where(
            TenantMember.user_id == user.id
        ).order_by(TenantMember.created_at.asc())
        member = (await db.execute(stmt_mem)).scalars().first()
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User has no workspace memberships")

    tenant_stmt = select(Tenant).where(Tenant.id == member.tenant_id)
    tenant = (await db.execute(tenant_stmt)).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    return TenantContext(tenant=tenant, member=member, user=user)

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    ctx: TenantContext = Depends(get_current_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads a document to the organization knowledge base.
    Validates file format, saves in tenant-isolated directory, 
    and dispatches background parsing, chunking, and embedding.
    """
    filename = file.filename or "uploaded_file"
    file_ext = Path(filename).suffix.lower()

    if file_ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{file_ext}'. Allowed formats: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    # Read content and check size limit
    content = await file.read()
    file_size = len(content)
    if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024*1024)} MB"
        )
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty"
        )

    # Save to tenant-isolated physical folder
    tenant_upload_dir = settings.UPLOAD_DIR / str(ctx.tenant_id)
    os.makedirs(tenant_upload_dir, exist_ok=True)

    doc_id = uuid.uuid4()
    safe_name = f"{doc_id}_{filename}"
    file_path = tenant_upload_dir / safe_name

    with open(file_path, "wb") as f:
        f.write(content)

    # Record in database
    doc = Document(
        id=doc_id,
        tenant_id=ctx.tenant_id,
        uploaded_by=ctx.user.id,
        filename=filename,
        file_type=file_ext.replace(".", "").upper(),
        file_size=file_size,
        file_path=str(file_path),
        processing_status=DocumentStatus.UPLOADING,
        total_chunks=0
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Dispatch asynchronous background ingestion
    background_tasks.add_task(
        IngestionService.process_document_background,
        document_id=doc.id,
        tenant_id=ctx.tenant_id,
        file_path=str(file_path),
        file_type=file_ext
    )

    return doc

@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    ctx: TenantContext = Depends(get_current_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns all documents belonging STRICTLY to the authenticated user's active tenant.
    Never exposes documents from other organizations.
    """
    stmt = (
        select(Document)
        .where(Document.tenant_id == ctx.tenant_id)
        .order_by(Document.created_at.desc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    ctx: TenantContext = Depends(get_current_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves document detail.
    Rejects any request for a document belonging to a different tenant.
    """
    stmt = select(Document).where(
        Document.id == document_id,
        Document.tenant_id == ctx.tenant_id
    )
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found in this organization workspace"
        )
    return doc

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    ctx: TenantContext = Depends(get_current_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Deletes a document and all corresponding chunks from the organization knowledge base.
    Enforces tenant isolation: will refuse to delete documents belonging to other tenants.
    """
    stmt = select(Document).where(
        Document.id == document_id,
        Document.tenant_id == ctx.tenant_id
    )
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or unauthorized"
        )

    # Remove physical file if exists
    try:
        if os.path.exists(doc.file_path):
            os.remove(doc.file_path)
    except Exception:
        pass

    # Delete from DB (cascades to chunks)
    await db.delete(doc)
    await db.commit()
    return None

@router.get("/{document_id}/file")
async def view_document_file(
    document_id: uuid.UUID,
    download: bool = False,
    ctx: TenantContext = Depends(get_tenant_context_for_file_view),
    db: AsyncSession = Depends(get_db)
):
    """
    Serves the original document file (PDF, TXT, DOCX, etc.) inline for viewing or downloading.
    Enforces tenant isolation: users can only view documents belonging to their active workspace.
    """
    stmt = select(Document).where(
        Document.id == document_id,
        Document.tenant_id == ctx.tenant_id
    )
    doc = (await db.execute(stmt)).scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied"
        )

    # If physical file exists, return FileResponse
    if doc.file_path and os.path.exists(doc.file_path):
        mime_type, _ = mimetypes.guess_type(doc.filename)
        if not mime_type:
            ext = Path(doc.filename).suffix.lower()
            if ext == ".pdf":
                mime_type = "application/pdf"
            elif ext in (".txt", ".md"):
                mime_type = "text/plain; charset=utf-8"
            elif ext == ".docx":
                mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            else:
                mime_type = "application/octet-stream"

        disposition = "attachment" if download else "inline"
        return FileResponse(
            path=doc.file_path,
            filename=doc.filename,
            media_type=mime_type,
            content_disposition_type=disposition
        )

    # Fallback: if physical file was cleared but chunks exist in database, reconstruct text
    chunks_stmt = select(DocumentChunk).where(
        DocumentChunk.document_id == doc.id,
        DocumentChunk.tenant_id == ctx.tenant_id
    ).order_by(DocumentChunk.chunk_index.asc())
    chunks = (await db.execute(chunks_stmt)).scalars().all()
    if chunks:
        reconstructed_text = "\n\n".join(c.content for c in chunks)
        disposition = "attachment" if download else "inline"
        return Response(
            content=reconstructed_text,
            media_type="text/plain; charset=utf-8",
            headers={
                "Content-Disposition": f'{disposition}; filename="{doc.filename}"'
            }
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Original file content is not available"
    )

