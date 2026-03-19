"""Google Sheets integration for reading/writing grades."""

import logging

import gspread
from google.oauth2.service_account import Credentials

from app.config import settings

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

HEADERS = [
    "Student ID",
    "Name",
    "Grade",
    "Compilation",
    "Tests Passed",
    "Banned Functions",
    "Similarity Score",
    "Notes",
]


def _get_client() -> gspread.Client:
    """Create an authenticated gspread client."""
    creds = Credentials.from_service_account_file(
        settings.GOOGLE_SHEETS_CREDS_FILE, scopes=SCOPES
    )
    return gspread.authorize(creds)


async def write_grades(
    spreadsheet_id: str, assignment_name: str, results: list[dict]
) -> None:
    """Write grading results to a worksheet named after the assignment.

    Creates the worksheet if it doesn't exist.
    """
    gc = _get_client()
    spreadsheet = gc.open_by_key(spreadsheet_id)

    # Find or create worksheet
    try:
        worksheet = spreadsheet.worksheet(assignment_name)
        worksheet.clear()
    except gspread.exceptions.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(
            title=assignment_name, rows=len(results) + 1, cols=len(HEADERS)
        )

    # Write headers
    worksheet.update("A1", [HEADERS])

    # Write student rows
    rows = []
    for r in results:
        rows.append([
            r.get("student_id", ""),
            r.get("name", ""),
            r.get("grade", ""),
            r.get("compilation", ""),
            r.get("tests_passed", ""),
            r.get("banned_functions", ""),
            r.get("similarity_score", ""),
            r.get("notes", ""),
        ])

    if rows:
        worksheet.update(f"A2:H{len(rows) + 1}", rows)
        logger.info("Wrote %d grades to sheet '%s'", len(rows), assignment_name)


async def update_grade(
    spreadsheet_id: str,
    assignment_name: str,
    student_id: str,
    new_grade: float,
    reason: str,
) -> None:
    """Update a specific student's grade and append reason to notes."""
    gc = _get_client()
    spreadsheet = gc.open_by_key(spreadsheet_id)
    worksheet = spreadsheet.worksheet(assignment_name)

    # Find the student row
    cell = worksheet.find(student_id)
    if not cell:
        logger.warning("Student %s not found in sheet '%s'", student_id, assignment_name)
        return

    row = cell.row
    # Update grade (column C = 3)
    worksheet.update_cell(row, 3, new_grade)
    # Append to notes (column H = 8)
    current_notes = worksheet.cell(row, 8).value or ""
    updated_notes = f"{current_notes}; Grade bumped to {new_grade}: {reason}".strip("; ")
    worksheet.update_cell(row, 8, updated_notes)
    logger.info("Updated grade for %s to %s", student_id, new_grade)


async def get_student(
    spreadsheet_id: str, assignment_name: str, student_id: str
) -> dict | None:
    """Get a student's record from the sheet."""
    gc = _get_client()
    spreadsheet = gc.open_by_key(spreadsheet_id)

    try:
        worksheet = spreadsheet.worksheet(assignment_name)
    except gspread.exceptions.WorksheetNotFound:
        return None

    cell = worksheet.find(student_id)
    if not cell:
        return None

    row_values = worksheet.row_values(cell.row)
    return {
        header: value
        for header, value in zip(HEADERS, row_values, strict=False)
        if value
    }
