import uuid
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from app.models.chat import MessageRole

class SourceCitation(BaseModel):
    document_id: str
    document_name: str
    page: int | None = None
    similarity: float
    snippet: str

class ChatRequest(BaseModel):
    conversation_id: uuid.UUID | None = Field(default=None, description="Existing conversation ID or None to start a new one")
    message: str = Field(..., min_length=1, max_length=4000)

class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    role: MessageRole
    content: str
    sources_meta: list[SourceCitation] | None = None
    created_at: datetime

class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    title: str
    created_at: datetime
    messages: list[MessageResponse] = []

class ChatResponse(BaseModel):
    conversation_id: uuid.UUID
    answer: str
    sources: list[SourceCitation]
    message_id: uuid.UUID
