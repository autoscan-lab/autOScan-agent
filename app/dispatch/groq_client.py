"""Groq API wrapper with tool-calling support."""

import json
import logging

from groq import AsyncGroq

from app.config import settings
from app.dispatch.tools import TOOLS

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are autOScan-agent, a grading assistant for OS lab submissions.
You help the teaching assistant grade student code by calling tools.
Parse the user's message and call the appropriate tool.
If the message is unclear, ask for clarification.
Keep responses short and direct."""

client = AsyncGroq(api_key=settings.GROQ_API_KEY)


async def dispatch(user_message: str) -> dict:
    """Send a message to Groq and return either a tool call or text response.

    Returns:
        dict with either:
            {"type": "tool_call", "name": str, "arguments": dict}
            {"type": "text", "content": str}
    """
    response = await client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        tools=TOOLS,
        tool_choice="auto",
    )

    message = response.choices[0].message

    if message.tool_calls:
        tool_call = message.tool_calls[0]
        arguments = json.loads(tool_call.function.arguments)
        logger.info("Tool call: %s(%s)", tool_call.function.name, arguments)
        return {
            "type": "tool_call",
            "name": tool_call.function.name,
            "arguments": arguments,
        }

    logger.info("Text response from Groq")
    return {
        "type": "text",
        "content": message.content or "",
    }
