"""Grading service — orchestrates the cloud grading pipeline."""

import json
import logging
import tempfile
from pathlib import Path

import httpx

from app.config import settings
from app.services.excel import write_grades
from app.whatsapp.client import download_media

logger = logging.getLogger(__name__)


async def run_grading(
    assignment_name: str, media_id: str | None = None
) -> dict:
    """Run the full grading pipeline.

    Steps:
        1. Download zip from WhatsApp (if media_id provided)
        2. Send zip to the private grading engine
        3. Parse the engine response
        4. Write results to an Excel workbook

    Returns:
        dict with 'summary' (str) and 'students' (dict).
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        local_zip = Path(tmpdir) / "submissions.zip"

        # Step 1: Download zip from WhatsApp
        if media_id:
            logger.info("Downloading submission zip from WhatsApp (media_id=%s)", media_id)
            zip_bytes = await download_media(media_id)
            if not zip_bytes:
                return {"summary": "Failed to download the zip file from WhatsApp.", "students": {}}
            local_zip.write_bytes(zip_bytes)
        else:
            return {
                "summary": "No submission file attached. Please send a zip file with the assignment name.",
                "students": {},
            }

        # Step 2: Load the assignment policy on the engine
        try:
            await _setup_assignment(assignment_name)
        except httpx.HTTPError as exc:
            logger.exception("Engine setup failed for assignment %s", assignment_name)
            return {
                "summary": f"Failed to load assignment '{assignment_name}' on the engine: {exc}",
                "students": {},
            }

        # Step 3: Send zip to the engine service
        try:
            results_data = await _grade_via_engine(local_zip)
        except httpx.HTTPError as exc:
            logger.exception("Engine request failed")
            return {
                "summary": f"Failed to contact the grading engine: {exc}",
                "students": {},
            }

        # Step 4: Parse results
        students = _parse_results(results_data)

        # Step 5: Write the Excel workbook
        workbook_path = await write_grades(assignment_name, list(students.values()))
        logger.info("Grading complete for %s: %d students", assignment_name, len(students))

        summary = _build_summary(assignment_name, students, workbook_path)
        return {
            "summary": summary,
            "students": students,
            "workbook_path": str(workbook_path),
            "workbook_filename": workbook_path.name,
        }


def _engine_headers() -> dict:
    if settings.ENGINE_SECRET:
        return {"X-Autoscan-Secret": settings.ENGINE_SECRET}
    return {}


async def _setup_assignment(assignment_name: str) -> None:
    timeout = httpx.Timeout(60.0, connect=30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{settings.ENGINE_URL.rstrip('/')}/setup/{assignment_name}",
            headers=_engine_headers(),
        )
    if not response.is_success:
        detail = _extract_error_detail(response)
        raise httpx.HTTPStatusError(detail, request=response.request, response=response)
    logger.info("Engine configured for assignment %s", assignment_name)


async def _grade_via_engine(local_zip: Path) -> dict:
    timeout = httpx.Timeout(300.0, connect=60.0)
    files = {"file": (local_zip.name, local_zip.read_bytes(), "application/zip")}

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{settings.ENGINE_URL.rstrip('/')}/grade",
            files=files,
            headers=_engine_headers(),
        )

    if response.is_success:
        return response.json()

    detail = _extract_error_detail(response)
    raise httpx.HTTPStatusError(detail, request=response.request, response=response)


def _extract_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text or f"HTTP {response.status_code}"

    detail = payload.get("detail")
    if isinstance(detail, str):
        return detail
    return response.text or f"HTTP {response.status_code}"


def _parse_results(data: dict) -> dict[str, dict]:
    """Parse engine JSON output into Excel workbook rows."""
    students: dict[str, dict] = {}
    for entry in data.get("results", []):
        sid = entry.get("id", "unknown")
        tests = entry.get("tests", {})
        total_tests = tests.get("total", 0)
        passed_tests = tests.get("passed", 0)

        banned_functions = sorted({hit.get("function", "") for hit in entry.get("banned_hits", []) if hit.get("function")})
        notes = _build_notes(entry, tests)

        students[sid] = {
            "student_id": sid,
            "name": "",
            "grade": _derive_review_status(entry, tests),
            "compilation": _compile_status(entry),
            "tests_passed": f"{passed_tests}/{total_tests}" if total_tests else "",
            "banned_functions": ", ".join(banned_functions),
            "similarity_score": "",
            "notes": notes,
        }
    return students


def _derive_review_status(entry: dict, tests: dict) -> str:
    if entry.get("compile_timeout") or not entry.get("compile_ok", False):
        return "FAIL"

    if tests.get("failed", 0) > 0 or tests.get("compile_failed", 0) > 0:
        return "FAIL"

    return "CHECK"


def _compile_status(entry: dict) -> str:
    if entry.get("compile_timeout"):
        return "timed_out"
    if entry.get("compile_ok"):
        return "ok"
    return "failed"


def _build_notes(entry: dict, tests: dict) -> str:
    notes: list[str] = []

    stderr = (entry.get("stderr") or "").strip()
    if stderr:
        notes.append(f"Compile stderr: {stderr}")

    failing_cases = []
    for case in tests.get("cases", []):
        status = case.get("status")
        if status == "pass":
            continue

        label = case.get("name") or f"test_{case.get('index', '?')}"
        message = case.get("message")
        if message:
            failing_cases.append(f"{label}: {status} ({message})")
        else:
            failing_cases.append(f"{label}: {status}")

    if failing_cases:
        notes.append("Tests: " + "; ".join(failing_cases))

    return " | ".join(notes)


def _build_summary(assignment_name: str, students: dict[str, dict], workbook_path: Path) -> str:
    """Build a human-readable summary of grading results."""
    if not students:
        return f"No results for {assignment_name}."

    fail_count = sum(1 for student in students.values() if student.get("grade") == "FAIL")
    check_count = sum(1 for student in students.values() if student.get("grade") == "CHECK")

    lines = [
        f"Grading complete for *{assignment_name}*",
        f"Students: {len(students)}",
        f"FAIL: {fail_count}",
        f"CHECK: {check_count}",
    ]
    return "\n".join(lines)
