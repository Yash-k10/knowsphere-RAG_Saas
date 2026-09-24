import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
import app.models  # load models first
from app.main import app as fastapi_app
from app.db.database import Base, sync_engine
from app.services.llm.base import LLMProvider
from app.services.llm import factory

class MockTestLLMProvider(LLMProvider):
    async def generate_answer(self, prompt: str, system_prompt: str = "") -> str:
        return "This is a verified test grounded answer based on the knowledge base."

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=sync_engine)
    # Patch LLM provider during test suite so tests don't require external API keys
    factory.get_llm_provider = lambda: MockTestLLMProvider()
    yield

@pytest_asyncio.fixture
async def async_client():
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
