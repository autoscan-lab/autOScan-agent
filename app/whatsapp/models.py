"""Pydantic models for Meta WhatsApp Cloud API webhook payloads."""

from pydantic import BaseModel


class WebhookMediaInfo(BaseModel):
    id: str
    mime_type: str | None = None
    sha256: str | None = None
    filename: str | None = None


class WebhookMessage(BaseModel):
    from_: str | None = None  # sender phone number
    id: str | None = None
    timestamp: str | None = None
    type: str | None = None
    text: dict | None = None  # {"body": "..."}
    document: WebhookMediaInfo | None = None

    class Config:
        populate_by_name = True

    @property
    def body(self) -> str | None:
        if self.text and "body" in self.text:
            return self.text["body"]
        return None

    @property
    def sender(self) -> str | None:
        return self.from_


class WebhookMetadata(BaseModel):
    display_phone_number: str | None = None
    phone_number_id: str | None = None


class WebhookContact(BaseModel):
    wa_id: str | None = None
    profile: dict | None = None


class WebhookValue(BaseModel):
    messaging_product: str | None = None
    metadata: WebhookMetadata | None = None
    contacts: list[WebhookContact] | None = None
    messages: list[WebhookMessage] | None = None


class WebhookChange(BaseModel):
    value: WebhookValue | None = None
    field: str | None = None


class WebhookEntry(BaseModel):
    id: str | None = None
    changes: list[WebhookChange] | None = None


class WebhookPayload(BaseModel):
    object: str | None = None
    entry: list[WebhookEntry] | None = None

    def extract_messages(self) -> list[tuple[str, WebhookMessage]]:
        """Extract (sender_phone, message) pairs from the payload."""
        results = []
        if not self.entry:
            return results
        for entry in self.entry:
            if not entry.changes:
                continue
            for change in entry.changes:
                if not change.value or not change.value.messages:
                    continue
                for msg in change.value.messages:
                    sender = msg.from_ or (
                        change.value.contacts[0].wa_id
                        if change.value.contacts
                        else None
                    )
                    if sender:
                        results.append((sender, msg))
        return results
