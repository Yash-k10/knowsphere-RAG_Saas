from abc import ABC, abstractmethod

class LLMProvider(ABC):
    """
    Abstract Interface for LLM generation.
    Decouples the RAG retrieval pipeline from the generation backend.
    Enables swapping between Cloud LLMs (Gemini/OpenAI) and local company-hosted models (Ollama/vLLM)
    without modifying any ingestion, chunking, or retrieval logic.
    """

    @abstractmethod
    async def generate_answer(self, prompt: str, system_prompt: str = "") -> str:
        """Generates an answer given a user prompt and optional system instructions."""
        pass
