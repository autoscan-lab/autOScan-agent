"""Dispatch handler — routes parsed tool calls to service functions."""

import logging
from pathlib import Path

from app.dispatch.groq_client import dispatch
from app.services.excel import get_student, update_grade, workbook_path_for_assignment
from app.services.grading import run_grading
from app.services.session import get_session

logger = logging.getLogger(__name__)


async def handle_message(sender: str, text: str, media_id: str | None = None) -> dict:
    """Process an incoming message and return an outbound response payload.

    Args:
        sender: Phone number of the sender.
        text: Message text.
        media_id: WhatsApp media ID if a document was attached.
    """
    session = get_session(sender)

    # Persist the media_id in session so it survives a follow-up message
    if media_id:
        session["pending_media_id"] = media_id

    # If a document was uploaded with no text, treat it as a submission upload
    if media_id and not text:
        text = "I'm uploading a submission zip file."

    result = await dispatch(text)

    if result["type"] == "text":
        return {"text": result["content"]}

    name = result["name"]
    args = result["arguments"]

    try:
        return await _execute_tool(sender, session, name, args, media_id)
    except Exception:
        logger.exception("Tool execution failed: %s", name)
        return f"Error executing {name}. Please try again."


async def _execute_tool(
    sender: str, session: dict, name: str, args: dict, media_id: str | None
) -> dict:
    """Execute a tool call and return an outbound response payload."""
    if name == "grade_submissions":
        assignment = args["assignment_name"]
        session["current_assignment"] = assignment
        effective_media_id = media_id or session.pop("pending_media_id", None)
        result = await run_grading(assignment, media_id=effective_media_id)
        session["students"] = result.get("students", {})
        session["workbook_path"] = result.get("workbook_path")
        return {
            "text": result.get("summary", "Grading complete."),
            "document_path": result.get("workbook_path"),
            "document_filename": result.get("workbook_filename"),
        }

    if name == "show_student":
        student_id = args["student_id"]
        # Check session first, fall back to workbook
        if student_id in session.get("students", {}):
            student = session["students"][student_id]
            return {"text": _format_student(student)}

        student = await get_student(session.get("current_assignment", ""), student_id)
        return {"text": _format_student(student) if student else f"Student {student_id} not found."}

    if name == "bump_grade":
        await update_grade(
            session.get("current_assignment", ""),
            args["student_id"],
            args["new_grade"],
            args["reason"],
        )
        # Update session too
        if args["student_id"] in session.get("students", {}):
            session["students"][args["student_id"]]["grade"] = args["new_grade"]
        return {"text": f"Updated {args['student_id']} grade to {args['new_grade']}. Reason: {args['reason']}"}

    if name == "list_students":
        students = session.get("students", {})
        if not students:
            return {"text": "No students in current session. Run a grading first."}
        lines = [f"*{sid}*: {s.get('grade', 'N/A')}" for sid, s in students.items()]
        return {"text": f"Students ({len(lines)}):\n" + "\n".join(lines)}

    if name == "export_grades":
        assignment = session.get("current_assignment", "unknown")
        workbook_path = session.get("workbook_path") or str(workbook_path_for_assignment(assignment))
        return {
            "text": f"Grades for *{assignment}* have been written to:\n{workbook_path}",
            "document_path": workbook_path,
            "document_filename": Path(workbook_path).name,
        }

    if name == "show_rubric":
        rubric = session.get("rubric")
        if rubric:
            return {"text": f"Current rubric:\n{rubric}"}
        return {"text": "No rubric loaded for current session."}

    return {"text": f"Unknown tool: {name}"}


def _format_student(student: dict) -> str:
    """Format a student result dict into a readable string."""
    lines = []
    for key, value in student.items():
        lines.append(f"*{key}*: {value}")
    return "\n".join(lines) if lines else "No data available."
