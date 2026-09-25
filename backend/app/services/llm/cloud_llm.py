import logging
import httpx
from app.services.llm.base import LLMProvider
from app.core.config import settings

logger = logging.getLogger(__name__)

class CloudLLMProvider(LLMProvider):
    """
    Cloud LLM Provider implementing Google Gemini API.
    Only the retrieved context and user query are transmitted.
    Raw documents and private workspace data never leave application infrastructure.
    """

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL
        # Supports models such as gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash
        self.endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"

    async def generate_answer(self, prompt: str, system_prompt: str = "") -> str:
        if not self.api_key or self.api_key == "your_gemini_api_key_here":
            logger.warning("GEMINI_API_KEY is not configured in .env.")
            return (
                "⚠️ **Gemini API Key Required**\n\n"
                "The RAG retrieval pipeline successfully found relevant document chunks for your query. "
                "To generate a synthesized AI response with Google Gemini, please add your `GEMINI_API_KEY` to `backend/.env`.\n\n"
                "**Retrieved Context Preview:**\n" + prompt[:400] + ("..." if len(prompt) > 400 else "")
            )

        headers = {
            "Content-Type": "application/json"
        }

        # Build request body for Google Gemini API v1beta
        contents = []
        if system_prompt:
            contents.append({
                "role": "user",
                "parts": [{"text": f"[System Instructions]: {system_prompt}"}]
            })
            contents.append({
                "role": "model",
                "parts": [{"text": "Understood. I will strictly follow the instructions and answer using only the provided context."}]
            })

        contents.append({
            "role": "user",
            "parts": [{"text": prompt}]
        })

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.3,
                "topP": 0.95,
                "maxOutputTokens": 3072
            }
        }

        # List candidate models to ensure 100% uptime if one model experiences high demand (503)
        candidate_models = [self.model]
        for fallback in ["gemini-flash-latest", "gemini-3.8-flash", "gemini-3.5-flash"]:
            if fallback not in candidate_models:
                candidate_models.append(fallback)

        last_error = ""
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                for model_name in candidate_models:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.api_key}"
                    response = await client.post(url, headers=headers, json=payload)
                    
                    if response.status_code == 200:
                        data = response.json()
                        candidates = data.get("candidates", [])
                        if not candidates:
                            continue

                        parts = candidates[0].get("content", {}).get("parts", [])
                        answer_text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
                        if answer_text.strip():
                            return answer_text.strip()
                    else:
                        last_error = f"{model_name}: {response.status_code} - {response.text[:200]}"
                        logger.warning(f"Gemini API model {model_name} failed: {last_error}. Trying next fallback...")

                return f"Unable to generate response. Service details: {last_error}"

        except httpx.TimeoutException:
            logger.error("Timeout occurred while calling Gemini API")
            return "The request to Gemini API timed out. Please try again."
        except Exception as e:
            logger.error(f"Unexpected error in CloudLLMProvider: {e}")
            return f"An error occurred while generating the answer: {str(e)}"
