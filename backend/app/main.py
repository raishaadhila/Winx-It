"""FastAPI application entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import me, plans, tasks
from app.core.config import settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


app = FastAPI(
    title="Winx It! API",
    version="1.0.0",
    description="Backend for the Winx It! gamified productivity app.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["meta"])
def health():
    return {
        "status": "ok",
        "env": settings.environment,
        "supabase_configured": bool(settings.supabase_url and settings.supabase_anon_key),
        "nvidia_configured": bool(settings.nvidia_api_key),
        "llm_provider": "nvidia",
        "llm_model": settings.nvidia_model,
        "llm_base_url": settings.nvidia_base_url,
    }


app.include_router(me.router)
app.include_router(plans.router)
app.include_router(tasks.router)
