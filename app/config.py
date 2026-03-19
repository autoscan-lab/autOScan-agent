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

    # SSH (university server)
    SSH_HOST: str = "matagalls.salle.url.edu"
    SSH_USER: str = "felipe.trejos"
    SSH_KEY_PATH: str
    SSH_REMOTE_DIR: str = "/home/felipe.trejos/autoscan-runs"

    # Google Sheets
    GOOGLE_SHEETS_CREDS_FILE: str
    GOOGLE_SHEETS_ID: str

    # Access control (comma-separated phone numbers)
    ALLOWED_PHONE_NUMBERS: str

    @property
    def allowed_numbers_set(self) -> set[str]:
        return {n.strip() for n in self.ALLOWED_PHONE_NUMBERS.split(",") if n.strip()}

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
