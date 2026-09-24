import uuid
import logging
from sqlalchemy import select, update
from app.db.database import AsyncSessionLocal
from app.models.document import Document, DocumentStatus
from app.models.chunk import DocumentChunk
from app.services.text_extractor import TextExtractor
from app.services.chunking_service import ChunkingService
from app.services.embedding_service import embedding_service

logger = logging.getLogger(__name__)

class IngestionService:
    @staticmethod
    async def process_document_background(
        document_id: uuid.UUID,
        tenant_id: uuid.UUID,
        file_path: str,
        file_type: str
    ):
        """
        Background task executing the complete document processing pipeline:
        Extraction -> Chunking -> Local Vector Embedding -> PostgreSQL Storage.
        """
        async with AsyncSessionLocal() as db:
            try:
                # Update status to PROCESSING
                await db.execute(
                    update(Document)
                    .where(Document.id == document_id, Document.tenant_id == tenant_id)
                    .values(processing_status=DocumentStatus.PROCESSING)
                )
                await db.commit()

                logger.info(f"Starting ingestion for document {document_id} ({file_path})")

                # Step 1: Text extraction
                extracted_pages = TextExtractor.extract(file_path=file_path, file_type=file_type)

                # Step 2: Chunking
                chunker = ChunkingService()
                chunks = chunker.chunk_extracted_pages(extracted_pages)
                if not chunks:
                    raise ValueError("Document yielded 0 chunks after text extraction.")

                logger.info(f"Document {document_id}: created {len(chunks)} chunks. Generating embeddings...")

                # Step 3: Local embedding generation
                chunk_texts = [c.content for c in chunks]
                embeddings = embedding_service.embed_documents(chunk_texts)

                # Step 4: Save chunks to PostgreSQL
                db_chunks = []
                for chunk_item, emb in zip(chunks, embeddings):
                    db_chunk = DocumentChunk(
                        tenant_id=tenant_id,
                        document_id=document_id,
                        chunk_index=chunk_item.chunk_index,
                        content=chunk_item.content,
                        page_number=chunk_item.page_number,
                        char_count=chunk_item.char_count,
                        embedding=emb,
                        embedding_json=emb
                    )
                    db_chunks.append(db_chunk)

                db.add_all(db_chunks)

                # Step 5: Mark document as READY
                await db.execute(
                    update(Document)
                    .where(Document.id == document_id, Document.tenant_id == tenant_id)
                    .values(
                        processing_status=DocumentStatus.READY,
                        total_chunks=len(chunks),
                        error_message=None
                    )
                )
                await db.commit()
                logger.info(f"Document {document_id} successfully processed and marked READY.")

            except Exception as e:
                logger.error(f"Ingestion failed for document {document_id}: {str(e)}", exc_info=True)
                await db.rollback()
                await db.execute(
                    update(Document)
                    .where(Document.id == document_id, Document.tenant_id == tenant_id)
                    .values(
                        processing_status=DocumentStatus.FAILED,
                        error_message=str(e)[:500]
                    )
                )
                await db.commit()
