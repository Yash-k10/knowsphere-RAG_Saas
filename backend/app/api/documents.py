import uuid
import os
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.db.database import get_db
from app.core.config import settings
from app.core.dependencies import get_current_tenant_context, TenantContext
from app.models.document import Document, DocumentStatus
from app.schemas.document import DocumentResponse
from app.services.ingestion_service import IngestionService

router = APIRouter(prefix="/documents", tags=["Documents"])

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
