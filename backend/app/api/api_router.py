from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.tenants import router as tenants_router
from app.api.documents import router as documents_router
from app.api.chat import router as chat_router
from app.api.members import router as members_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(tenants_router)
api_router.include_router(documents_router)
api_router.include_router(chat_router)
api_router.include_router(members_router)
