"""WhatsApp webhook routes."""

import logging

from fastapi import APIRouter, BackgroundTasks, Query, Request, Response

from app.config import settings
from app.dispatch.handler import handle_message
from app.whatsapp.client import send_text
from app.whatsapp.models import WebhookPayload

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhook", tags=["whatsapp"])


@router.get("")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
) -> Response:
    """Meta webhook verification challenge."""
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("Webhook verified successfully")
        return Response(content=hub_challenge, media_type="text/plain")
    logger.warning("Webhook verification failed")
    return Response(content="Forbidden", status_code=403)


@router.post("")
async def receive_message(request: Request, background_tasks: BackgroundTasks):
    """Receive incoming WhatsApp messages.

    Returns 200 immediately and processes in background (Meta requires fast response).
    """
    body = await request.json()
    payload = WebhookPayload(**body)
    messages = payload.extract_messages()

    for sender, msg in messages:
        # Access control
        if sender not in settings.allowed_numbers_set:
            logger.warning("Ignored message from unauthorized number: %s", sender)
            continue

        background_tasks.add_task(_process_message, sender, msg)

    return Response(status_code=200)


async def _process_message(sender: str, msg) -> None:
    """Process a single incoming message in the background."""
    try:
        text = msg.body
        media_id = msg.document.id if msg.document else None

        if not text and not media_id:
            logger.info("Ignoring non-text/non-document message from %s", sender)
            return

        response = await handle_message(
            sender=sender,
            text=text or "",
            media_id=media_id,
        )
        await send_text(sender, response)
    except Exception:
        logger.exception("Error processing message from %s", sender)
        await send_text(sender, "Something went wrong processing your message. Please try again.")
