import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy import create_engine, text
from app.core.config import settings

logger = logging.getLogger(__name__)

# Async engine for FastAPI endpoints
async_engine = create_async_engine(
    settings.DATABASE_URL_ASYNC,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Sync engine for migrations, initial setup and tests
sync_engine = create_engine(
    settings.DATABASE_URL_SYNC,
    echo=False,
    pool_pre_ping=True
)

Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that provides an async database session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

def check_and_init_vector_extension() -> bool:
    """Checks if pgvector extension is available in PostgreSQL."""
    try:
        with sync_engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
            logger.info("pgvector extension enabled successfully in PostgreSQL.")
            return True
    except Exception as e:
        logger.warning(
            f"pgvector extension not installed in PostgreSQL ({e}). "
            "Falling back to PostgreSQL array + cosine similarity calculations. "
            "To enable native HNSW pgvector indexing, run 'install_pgvector.bat' as Administrator."
        )
        return False
