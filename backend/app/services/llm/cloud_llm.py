import logging
import asyncio
import httpx
from app.services.llm.base import LLMProvider
from app.core.config import settings

logger = logging.getLogger(__name__)

# Valid Gemini model names — as of Oct 2026, Google has migrated to 3.x naming.
# Order: primary configured model first, then fast/cheap fallbacks.
_FALLBACK_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
]

class CloudLLMProvider(LLMProvider):
    """
    Cloud LLM Provider implementing Google Gemini API.
    Only the retrieved context and user query are transmitted.
    Raw documents and private workspace data never leave application infrastructure.
    """

    # Per-model request timeout (seconds) — keeps total time bounded even
    # when multiple fallbacks are tried.
    _PER_MODEL_TIMEOUT = 35.0

    # Max retries for transient errors (429 / 503) on a single model.
    _MAX_RETRIES = 2

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL
        self.endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"

    def _build_candidate_models(self) -> list[str]:
        """Return an ordered list of models to try, starting with the configured one."""
        models = [self.model]
        for fallback in _FALLBACK_MODELS:
            if fallback not in models:
                models.append(fallback)
        return models

    async def generate_answer(self, prompt: str, system_prompt: str = "") -> str:
        if not self.api_key or self.api_key == "your_gemini_api_key_here":
            logger.warning("GEMINI_API_KEY is not configured in .env.")
            return (
                "⚠️ **Gemini API Key Required**\n\n"
                "The RAG retrieval pipeline successfully found relevant document chunks for your query. "
                "To generate a synthesized AI response with Google Gemini, please add your `GEMINI_API_KEY` to `backend/.env`.\n\n"
                "**Retrieved Context Preview:**\n" + prompt[:400] + ("..." if len(prompt) > 400 else "")
            )

        headers = {"Content-Type": "application/json"}

        # Build request body using the proper systemInstruction field
        # instead of faking system instructions as user/model conversation turns.
        contents = [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ]

        payload: dict = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.3,
                "topP": 0.95,
                "maxOutputTokens": 4096
            }
        }

        # Use the dedicated systemInstruction field (supported on v1beta)
        if system_prompt:
            payload["systemInstruction"] = {
                "parts": [{"text": system_prompt}]
            }

        candidate_models = self._build_candidate_models()
        last_error = ""

        try:
            async with httpx.AsyncClient(timeout=self._PER_MODEL_TIMEOUT) as client:
                for model_name in candidate_models:
                    url = (
                        f"https://generativelanguage.googleapis.com/v1beta/models/"
                        f"{model_name}:generateContent?key={self.api_key}"
                    )

                    # Retry loop for transient errors on each model
                    for attempt in range(1, self._MAX_RETRIES + 1):
                        try:
                            response = await client.post(url, headers=headers, json=payload)
                        except httpx.TimeoutException:
                            last_error = f"{model_name}: request timed out (attempt {attempt})"
                            logger.warning(last_error)
                            break  # move to next model on timeout

                        if response.status_code == 200:
                            data = response.json()
                            candidates = data.get("candidates", [])
                            if not candidates:
                                last_error = f"{model_name}: 200 but no candidates in response"
                                logger.warning(last_error)
                                break  # move to next model

                            parts = candidates[0].get("content", {}).get("parts", [])
                            answer_text = "".join(
                                part.get("text", "") for part in parts if isinstance(part, dict)
                            )
                            if answer_text.strip():
                                return answer_text.strip()
                            else:
                                last_error = f"{model_name}: 200 but empty answer text"
                                logger.warning(last_error)
                                break

                        elif response.status_code in (429, 503) and attempt < self._MAX_RETRIES:
                            # Transient — wait and retry
                            wait = 2 ** attempt
                            logger.warning(
                                f"Gemini API {model_name} returned {response.status_code}, "
                                f"retrying in {wait}s (attempt {attempt}/{self._MAX_RETRIES})..."
                            )
                            await asyncio.sleep(wait)
                        else:
                            last_error = f"{model_name}: HTTP {response.status_code} - {response.text[:300]}"
                            logger.warning(f"Gemini API failed: {last_error}. Trying next fallback...")
                            break  # move to next model

            logger.error(f"All Gemini models exhausted. Last error: {last_error}")
            return (
                "⚠️ Unable to generate an AI answer at this moment. "
                "The Gemini API returned errors for all attempted models. "
                "Please try again in a few seconds, or check your API key configuration.\n\n"
                f"Details: {last_error}"
            )

        except httpx.TimeoutException:
            logger.error("Overall timeout while calling Gemini API")
            return (
                "⚠️ The request to Gemini API timed out. "
                "This usually happens under heavy load. Please try again."
            )
        except Exception as e:
            logger.error(f"Unexpected error in CloudLLMProvider: {e}", exc_info=True)
            return f"⚠️ An error occurred while generating the answer: {str(e)}"
