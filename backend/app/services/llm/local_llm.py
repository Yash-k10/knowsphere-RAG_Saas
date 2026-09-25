import logging
import httpx
from app.services.llm.base import LLMProvider

logger = logging.getLogger(__name__)

class LocalLLMProvider(LLMProvider):
    """
    Local/Company LLM Provider for internally hosted inference servers
    (e.g., Ollama, vLLM, Text Generation Inference, or internal company API gateway).
    
    This implementation enables true 100% on-premise private RAG by routing retrieved
    context directly to an on-premise server without internet egress.
    """

    def __init__(self, base_url: str = "http://localhost:11434/v1", model: str = "llama3.2"):
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def generate_answer(self, prompt: str, system_prompt: str = "") -> str:
        url = f"{self.base_url}/chat/completions"
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1024
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data["choices"][0]["message"]["content"].strip()
                else:
                    return f"Local LLM returned status {res.status_code}: {res.text}"
        except Exception as e:
            logger.error(f"Failed to communicate with Local LLM at {url}: {e}")
            return f"Failed to connect to local LLM server at {self.base_url}. Ensure your local model server (Ollama/vLLM) is running."
