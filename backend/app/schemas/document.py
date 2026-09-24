import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.document import DocumentStatus

class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    filename: str
    file_type: str
    file_size: int
    processing_status: DocumentStatus
    error_message: str | None = None
    total_chunks: int
    created_at: datetime
    uploaded_by: uuid.UUID | None = None

class DocumentChunkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: uuid.UUID
    chunk_index: int
    content: str
    page_number: int | None = None
    char_count: int
