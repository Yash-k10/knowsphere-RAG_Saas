import pytest
import uuid
from app.services.chunking_service import ChunkingService
from app.services.embedding_service import embedding_service
from app.services.rag_service import (
    RAGService,
    extract_comparison_entities,
    normalize_query
)
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

def test_query_normalization_typos():
    q = "comapre pythn and jva db archtecture"
    normalized = normalize_query(q)
    assert "compare" in normalized
    assert "python" in normalized
    assert "java" in normalized
    assert "database" in normalized
    assert "architecture" in normalized

def test_extract_comparison_entities():
    # Test compare with typos
    assert extract_comparison_entities("comapre pythn and jva") == ["pythn", "jva"]
    assert extract_comparison_entities("diffrence between PostgreSQL and MongoDB") == ["PostgreSQL", "MongoDB"]
    assert extract_comparison_entities("FastAPI vs. Celery") == ["FastAPI", "Celery"]
    assert extract_comparison_entities("how does REST differ from GraphQL?") == ["REST", "GraphQL"]
    assert extract_comparison_entities("which is better: Docker or Podman") == ["Docker", "Podman"]
    assert extract_comparison_entities("Sick leave vs Maternity leave") == ["Sick leave", "Maternity leave"]

@pytest.mark.asyncio
async def test_rag_no_context_safe_response():
    """Verifies that queries with no relevant documents answer via LLM with clear General Knowledge disclaimer."""
    async with AsyncSessionLocal() as db:
        empty_tenant_id = uuid.uuid4()
        result = await RAGService.answer_query(
            db=db,
            tenant_id=empty_tenant_id,
            query="What is the internal reimbursement policy for international flights?"
        )
        assert "not found in your organization's knowledge base" in result.answer.lower()
        assert "general ai knowledge" in result.answer.lower()
        assert len(result.sources) == 0
        # Check that it actually gave an answer (not just empty or refusal)
        assert len(result.answer) > 80
