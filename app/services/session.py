"""In-memory per-user grading session state."""

import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

SESSION_TIMEOUT = timedelta(hours=2)

# Keyed by phone number
_sessions: dict[str, dict] = {}


def get_session(phone: str) -> dict:
    """Get or create a session for the given phone number.

    Sessions expire after 2 hours of inactivity.
    """
    now = datetime.now()

    if phone in _sessions:
        session = _sessions[phone]
        if now - session["last_active"] > SESSION_TIMEOUT:
            logger.info("Session expired for %s, creating new one", phone)
            _sessions[phone] = _new_session(now)
        else:
            session["last_active"] = now
        return _sessions[phone]

    logger.info("Creating new session for %s", phone)
    _sessions[phone] = _new_session(now)
    return _sessions[phone]


def _new_session(now: datetime) -> dict:
    return {
        "current_assignment": None,
        "students": {},
        "workbook_path": None,
        "rubric": None,
        "last_active": now,
    }


def clear_session(phone: str) -> None:
    """Clear a session explicitly."""
    _sessions.pop(phone, None)
