"""Dispatch handler — routes parsed tool calls to service functions."""

import logging

from app.dispatch.groq_client import dispatch
from app.services.grading import run_grading
from app.services.session import get_session
from app.services.sheets import get_student, update_grade

logger = logging.getLogger(__name__)


async def handle_message(sender: str, text: str, media_id: str | None = None) -> str:
    """Process an incoming message and return a response string.

    Args:
        sender: Phone number of the sender.
        text: Message text.
        media_id: WhatsApp media ID if a document was attached.
    """
    session = get_session(sender)

    # If a document was uploaded with no text, treat it as a submission upload
    if media_id and not text:
        text = "I'm uploading a submission zip file."

    result = await dispatch(text)

    if result["type"] == "text":
        return result["content"]

    name = result["name"]
    args = result["arguments"]

    try:
        return await _execute_tool(sender, session, name, args, media_id)
    except Exception:
        logger.exception("Tool execution failed: %s", name)
        return f"Error executing {name}. Please try again."


async def _execute_tool(
    sender: str, session: dict, name: str, args: dict, media_id: str | None
) -> str:
    """Execute a tool call and return a response string."""
    if name == "grade_submissions":
        assignment = args["assignment_name"]
        session["current_assignment"] = assignment
        result = await run_grading(assignment, media_id=media_id)
        session["students"] = result.get("students", {})
        return result.get("summary", "Grading complete.")

    if name == "show_student":
        student_id = args["student_id"]
        # Check session first, fall back to sheets
        if student_id in session.get("students", {}):
            student = session["students"][student_id]
            return _format_student(student)
        from app.config import settings

        student = await get_student(
            settings.GOOGLE_SHEETS_ID,
            session.get("current_assignment", ""),
            student_id,
        )
        return _format_student(student) if student else f"Student {student_id} not found."

    if name == "bump_grade":
        from app.config import settings

        await update_grade(
            settings.GOOGLE_SHEETS_ID,
            session.get("current_assignment", ""),
            args["student_id"],
            args["new_grade"],
            args["reason"],
        )
        # Update session too
        if args["student_id"] in session.get("students", {}):
            session["students"][args["student_id"]]["grade"] = args["new_grade"]
        return f"Updated {args['student_id']} grade to {args['new_grade']}. Reason: {args['reason']}"

    if name == "list_students":
        students = session.get("students", {})
        if not students:
            return "No students in current session. Run a grading first."
        lines = [f"*{sid}*: {s.get('grade', 'N/A')}" for sid, s in students.items()]
        return f"Students ({len(lines)}):\n" + "\n".join(lines)

    if name == "export_grades":
        from app.config import settings

        sheet_url = f"https://docs.google.com/spreadsheets/d/{settings.GOOGLE_SHEETS_ID}"
        assignment = session.get("current_assignment", "unknown")
        return f"Grades for *{assignment}* have been written to the sheet.\n{sheet_url}"

    if name == "show_rubric":
        rubric = session.get("rubric")
        if rubric:
            return f"Current rubric:\n{rubric}"
        return "No rubric loaded for current session."

    return f"Unknown tool: {name}"


def _format_student(student: dict) -> str:
    """Format a student result dict into a readable string."""
    lines = []
    for key, value in student.items():
        lines.append(f"*{key}*: {value}")
    return "\n".join(lines) if lines else "No data available."
