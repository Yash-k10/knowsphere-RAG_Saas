import pytest
import uuid
from app.services.chunking_service import ChunkingService
from app.services.embedding_service import embedding_service
from app.services.rag_service import RAGService
from app.db.database import AsyncSessionLocal

def test_chunking_service_sliding_window():
    chunker = ChunkingService(chunk_size=100, chunk_overlap=20)
    sample_text = (
        "KnowSphere is an enterprise AI knowledge assistant designed for multi-tenant data isolation. "
        "It splits documents into overlapping chunks so that semantic context is preserved across boundaries. "
        "Each chunk is stored in PostgreSQL alongside its vector representation."
    )
    pages = [{"page_number": 1, "text": sample_text}]
    chunks = chunker.chunk_extracted_pages(pages)

    assert len(chunks) > 1
    assert chunks[0].page_number == 1
    assert chunks[0].chunk_index == 0
    assert chunks[1].chunk_index == 1

def test_local_embeddings():
    vec = embedding_service.embed_text("Employee leave policy and health insurance.")
    assert isinstance(vec, list)
    assert len(vec) == 384
    for val in vec:
        assert isinstance(val, float)

@pytest.mark.asyncio
async def test_rag_no_context_safe_response():
    """Verifies that queries with no relevant documents produce a safe message without hallucinating."""
    async with AsyncSessionLocal() as db:
        empty_tenant_id = uuid.uuid4()
        result = await RAGService.answer_query(
            db=db,
            tenant_id=empty_tenant_id,
            query="What is the internal reimbursement policy for international flights?"
        )
        assert "couldn't find relevant information" in result.answer.lower()
        assert len(result.sources) == 0
