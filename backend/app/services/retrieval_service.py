import uuid
import logging
from dataclasses import dataclass
from typing import List
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.models.chunk import DocumentChunk, is_vector_ready
from app.models.document import Document, DocumentStatus
from app.core.config import settings

logger = logging.getLogger(__name__)

@dataclass
class RetrievedChunk:
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_name: str
    page_number: int | None
    content: str
    similarity: float

class RetrievalService:
    @staticmethod
    async def search_similar_chunks(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        query_embedding: List[float],
        top_k: int = settings.TOP_K_CHUNKS,
        similarity_threshold: float = settings.SIMILARITY_THRESHOLD
    ) -> List[RetrievedChunk]:
        """
        Retrieves top-k semantically relevant chunks strictly isolated to tenant_id.
        TENANT ISOLATION GUARANTEE:
        Under NO circumstances does this query execute without `tenant_id == authorized_tenant_id`.
        """
        # If pgvector is installed and enabled, run native HNSW/IVFFlat query
        if is_vector_ready:
            try:
                vector_str = f"[{','.join(str(x) for x in query_embedding)}]"
                query = text("""
                    SELECT 
                        dc.id as chunk_id,
                        dc.document_id,
                        d.filename as document_name,
                        dc.page_number,
                        dc.content,
                        (1.0 - (dc.embedding <=> CAST(:vector AS vector))) as similarity
                    FROM document_chunks dc
                    JOIN documents d ON d.id = dc.document_id
                    WHERE dc.tenant_id = :tenant_id
                      AND d.processing_status = 'READY'
                      AND dc.embedding IS NOT NULL
                    ORDER BY dc.embedding <=> CAST(:vector AS vector) ASC
                    LIMIT :top_k;
                """)
                result = await db.execute(query, {
                    "vector": vector_str,
                    "tenant_id": tenant_id,
                    "top_k": top_k
                })
                rows = result.fetchall()

                retrieved = []
                for row in rows:
                    sim = float(row.similarity) if row.similarity is not None else 0.0
                    if sim >= similarity_threshold:
                        retrieved.append(RetrievedChunk(
                            chunk_id=row.chunk_id,
                            document_id=row.document_id,
                            document_name=row.document_name,
                            page_number=row.page_number,
                            content=row.content,
                            similarity=round(sim, 4)
                        ))
                return retrieved
            except Exception as e:
                logger.warning(f"Native pgvector query failed ({e}), rolling back and falling back to resilient cosine computation.")
                await db.rollback()

        # Resilient fallback: fetch chunks scoped strictly to tenant_id and compute cosine similarity
        stmt = (
            select(DocumentChunk, Document.filename)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(
                DocumentChunk.tenant_id == tenant_id,
                Document.processing_status == DocumentStatus.READY
            )
        )
        result = await db.execute(stmt)
        records = result.all()

        if not records:
            return []

        q_vec = np.array(query_embedding, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return []

        scored_candidates = []
        for chunk, doc_name in records:
            cand_vec = None
            if chunk.embedding is not None and isinstance(chunk.embedding, (list, tuple, np.ndarray)):
                cand_vec = np.array(chunk.embedding, dtype=np.float32)
            elif chunk.embedding_json:
                cand_vec = np.array(chunk.embedding_json, dtype=np.float32)

            if cand_vec is not None:
                c_norm = np.linalg.norm(cand_vec)
                if c_norm > 0:
                    sim = float(np.dot(q_vec, cand_vec) / (q_norm * c_norm))
                    if sim >= similarity_threshold:
                        scored_candidates.append((sim, chunk, doc_name))

        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        top_matches = scored_candidates[:top_k]

        return [
            RetrievedChunk(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                document_name=doc_name,
                page_number=chunk.page_number,
                content=chunk.content,
                similarity=round(sim, 4)
            )
            for sim, chunk, doc_name in top_matches
        ]
