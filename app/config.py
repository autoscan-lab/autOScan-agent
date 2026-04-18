"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All required configuration loaded from .env file."""

    # WhatsApp Meta Cloud API
    WHATSAPP_VERIFY_TOKEN: str
    WHATSAPP_ACCESS_TOKEN: str
    WHATSAPP_PHONE_NUMBER_ID: str

    # Groq
    GROQ_API_KEY: str
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Private grading engine
    ENGINE_URL: str
    ENGINE_SECRET: str = ""

    # Local workbook export
    GRADE_EXPORT_DIR: str = "exports"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
