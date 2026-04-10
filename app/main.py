"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.whatsapp.router import router as whatsapp_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Validate configuration on startup."""
    logger.info("autOScan-agent starting up")
    logger.info("Groq model: %s", settings.GROQ_MODEL)
    logger.info("Engine URL: %s", settings.ENGINE_URL)
    yield
    logger.info("autOScan-agent shutting down")


app = FastAPI(
    title="autOScan-agent",
    description="WhatsApp agent for grading OS lab submissions.",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(whatsapp_router)


@app.get("/")
async def health_check():
    return {"status": "ok", "service": "autOScan-agent"}
