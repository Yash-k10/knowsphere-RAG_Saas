"""
KnowSphere Document Chunking Service
====================================
Why is Chunking Essential for RAG?
-----------------------------------
1. Model Context Limitations:
   Local embedding models (e.g. all-MiniLM-L6-v2, BGE-small) operate with fixed token lengths 
   (typically 256 to 512 tokens). Passing full documents causes truncation or semantic dilution.

2. Semantic Resolution & Dilution:
   Embedding an entire 30-page document into a single vector averages out specific facts. 
   Granular chunking ensures that precise sentences (e.g., "annual leave is 18 days") retain 
   their distinct mathematical vector representation.

3. Context Window Efficiency & Precision:
   LLMs have token limits and higher costs with massive contexts. Passing only top-k relevant 
   chunks maximizes prompt space for reasoning and grounds the generation.

4. Overlap for Semantic Continuity:
   When sentences or ideas span the border between two consecutive chunks, overlap 
   (e.g., 100 characters) ensures no vital context is truncated or lost in translation.
"""

from dataclasses import dataclass
from app.core.config import settings

@dataclass
class ChunkItem:
    chunk_index: int
    content: str
    page_number: int | None
    char_count: int

class ChunkingService:
    def __init__(self, chunk_size: int = settings.CHUNK_SIZE, chunk_overlap: int = settings.CHUNK_OVERLAP):
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be strictly less than chunk_size")
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_extracted_pages(self, pages: list[dict]) -> list[ChunkItem]:
        """
        Splits extracted pages/segments into overlapping semantic chunks,
        preserving original page numbers where available.
        """
        chunks: list[ChunkItem] = []
        global_chunk_idx = 0

        for page_data in pages:
            page_num = page_data.get("page_number")
            raw_text = page_data.get("text", "").strip()
            if not raw_text:
                continue

            page_chunks = self._chunk_text(raw_text)
            for chunk_str in page_chunks:
                chunks.append(ChunkItem(
                    chunk_index=global_chunk_idx,
                    content=chunk_str,
                    page_number=page_num,
                    char_count=len(chunk_str)
                ))
                global_chunk_idx += 1

        return chunks

    def _chunk_text(self, text: str) -> list[str]:
        """
        Sliding window chunking strategy with boundary awareness 
        (breaks on paragraphs or sentences where possible).
        """
        if len(text) <= self.chunk_size:
            return [text]

        chunks = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = start + self.chunk_size
            if end >= text_len:
                chunk = text[start:].strip()
                if chunk:
                    chunks.append(chunk)
                break

            # Try to snap to the nearest paragraph break or sentence end
            sub = text[start:end]
            best_break = -1
            for separator in ["\n\n", "\n", ". ", "? ", "! "]:
                pos = sub.rfind(separator)
                if pos != -1 and pos > (self.chunk_size // 2):
                    best_break = pos + len(separator)
                    break

            if best_break != -1:
                chunk = text[start:start + best_break].strip()
                start = start + best_break - self.chunk_overlap
            else:
                chunk = text[start:end].strip()
                start = end - self.chunk_overlap

            if chunk:
                chunks.append(chunk)

        return chunks
