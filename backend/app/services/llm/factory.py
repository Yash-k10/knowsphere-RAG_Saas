from app.core.config import settings
from app.services.llm.base import LLMProvider
from app.services.llm.cloud_llm import CloudLLMProvider
from app.services.llm.local_llm import LocalLLMProvider

def get_llm_provider() -> LLMProvider:
    """Factory function returning the configured LLM provider instance."""
    if settings.LLM_PROVIDER.lower() == "local":
        return LocalLLMProvider()
    return CloudLLMProvider()
