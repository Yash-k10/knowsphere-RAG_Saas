import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.database import sync_engine, Base, check_and_init_vector_extension
import app.models  # Ensure all models are registered with Base.metadata
from app.api.api_router import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("knowsphere")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables & extensions
    logger.info("Initializing KnowSphere database and models...")
    try:
        check_and_init_vector_extension()
        Base.metadata.create_all(bind=sync_engine)
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Error during database startup initialization: {e}")
    yield
    # Shutdown
    logger.info("Shutting down KnowSphere backend.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Enterprise Multi-Tenant RAG Knowledge Assistant with strict tenant-level data isolation.",
    lifespan=lifespan
)

# CORS setup for React Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/", tags=["Health"])
async def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "description": "Enterprise Multi-Tenant RAG Knowledge Assistant"
    }

@app.get("/health", tags=["Health"])
async def health():
    return {
        "status": "healthy",
        "llm_provider": settings.LLM_PROVIDER,
        "embedding_model": settings.EMBEDDING_MODEL_NAME
    }
