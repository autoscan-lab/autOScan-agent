"""Groq API wrapper with tool-calling support."""

import json
import logging

from groq import AsyncGroq, BadRequestError

from app.config import settings
from app.dispatch.tools import TOOLS

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are autOScan-agent, a grading assistant for OS lab assignments.
Your only job is to help grade student code submissions.

To grade, the user must provide:
- A zip file with the submissions
- The lab name (e.g. S0, S1, S2)

If the user says hi, asks for help, or says anything unrelated to grading, reply briefly explaining you are a grading assistant and ask them to send a zip file with the lab name.
Only call grade_submissions when you have a real lab name (like S0, S1, S2). Never use placeholder values.
Keep all responses short and direct."""

client = AsyncGroq(api_key=settings.GROQ_API_KEY)


async def dispatch(user_message: str) -> dict:
    """Send a message to Groq and return either a tool call or text response.

    Returns:
        dict with either:
            {"type": "tool_call", "name": str, "arguments": dict}
            {"type": "text", "content": str}
    """
    try:
        response = await client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            tools=TOOLS,
            tool_choice="auto",
        )
    except BadRequestError:
        logger.exception("Groq bad request — likely malformed tool call")
        return {"type": "text", "content": "I couldn't understand that. Please send the zip file and lab name together (e.g. 'grade S0')."}

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
