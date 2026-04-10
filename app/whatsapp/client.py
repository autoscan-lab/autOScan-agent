"""WhatsApp Cloud API client for sending messages."""

import logging
from pathlib import Path

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

API_BASE = f"https://graph.facebook.com/v21.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
MEDIA_BASE = f"https://graph.facebook.com/v21.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/media"


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }


async def send_text(to: str, body: str) -> None:
    """Send a text message via WhatsApp Cloud API."""
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": body},
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(API_BASE, json=payload, headers=_headers())
        if resp.status_code != 200:
            logger.error("Failed to send text to %s: %s", to, resp.text)
        else:
            logger.info("Sent text to %s", to)


async def send_document(to: str, media_id: str, filename: str, caption: str) -> None:
    """Send a document via WhatsApp Cloud API using an uploaded media id."""
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "document",
        "document": {
            "id": media_id,
            "filename": filename,
            "caption": caption,
        },
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(API_BASE, json=payload, headers=_headers())
        if resp.status_code != 200:
            logger.error("Failed to send document to %s: %s", to, resp.text)
        else:
            logger.info("Sent document to %s", to)


async def upload_document(file_path: str, mime_type: str) -> str | None:
    """Upload a local document to Meta and return the media id."""
    path = Path(file_path)
    if not path.exists():
        logger.error("Document not found for upload: %s", file_path)
        return None

    headers = {"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"}
    data = {
        "messaging_product": "whatsapp",
        "type": mime_type,
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=30.0)) as client:
        with path.open("rb") as file_handle:
            files = {"file": (path.name, file_handle, mime_type)}
            resp = await client.post(MEDIA_BASE, headers=headers, data=data, files=files)

    if resp.status_code != 200:
        logger.error("Failed to upload document %s: %s", file_path, resp.text)
        return None

    media_id = resp.json().get("id")
    if not media_id:
        logger.error("No media id returned for document %s", file_path)
        return None

    logger.info("Uploaded document %s with media id %s", file_path, media_id)
    return media_id


async def download_media(media_id: str) -> bytes | None:
    """Download media from WhatsApp by media ID.

    Two-step process: first get the media URL, then download the file.
    """
    media_url_endpoint = f"https://graph.facebook.com/v21.0/{media_id}"
    headers = {"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"}

    async with httpx.AsyncClient() as client:
        # Step 1: Get the download URL
        resp = await client.get(media_url_endpoint, headers=headers)
        if resp.status_code != 200:
            logger.error("Failed to get media URL for %s: %s", media_id, resp.text)
            return None
        download_url = resp.json().get("url")
        if not download_url:
            logger.error("No URL in media response for %s", media_id)
            return None

        # Step 2: Download the actual file
        resp = await client.get(download_url, headers=headers)
        if resp.status_code != 200:
            logger.error("Failed to download media %s: %s", media_id, resp.text)
            return None
        return resp.content
