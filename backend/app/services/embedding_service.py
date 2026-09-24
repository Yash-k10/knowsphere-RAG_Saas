"""
KnowSphere Local Embedding Service
==================================
Runs 100% locally inside the application environment using ONNX / fastembed.
No external network calls or cloud APIs are made for vector embeddings.
"""

import logging
from typing import List
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmbeddingService:
    _instance = None
    _model = None

    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        self.model_name = model_name

    @classmethod
    def get_instance(cls) -> "EmbeddingService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_model(self):
        if self._model is None:
            logger.info(f"Loading local embedding model: {self.model_name}...")
            try:
                from fastembed import TextEmbedding
                self._model = TextEmbedding(model_name=self.model_name)
                logger.info("Local embedding model loaded successfully.")
            except Exception as e:
                logger.error(f"Failed to load fastembed model: {e}")
                raise e
        return self._model

    def embed_text(self, text: str) -> List[float]:
        """Generates a 384-dimensional vector embedding for a single string."""
        results = self.embed_documents([text])
        return results[0]

    def embed_query(self, query: str) -> List[float]:
        """
        Embeds a search query. 
        Prepends query instruction if needed by the embedding architecture.
        """
        return self.embed_text(query)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """
        Batch embeds a list of document chunks locally.
        Returns a list of 384-dimensional floating point vectors.
        """
        if not texts:
            return []
        model = self._get_model()
        embeddings_generator = model.embed(texts)
        return [emb.tolist() for emb in embeddings_generator]

# Global singleton accessor
embedding_service = EmbeddingService.get_instance()
