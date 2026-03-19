"""Grading service — orchestrates the full grading pipeline.

Pipeline: download zip from WhatsApp -> SSH upload -> run engine -> pull results -> write to sheets.
"""

import json
import logging
import tempfile
from datetime import datetime
from pathlib import Path

from app.config import settings
from app.services.sheets import write_grades
from app.utils.ssh import download_file, run_command, upload_file
from app.whatsapp.client import download_media

logger = logging.getLogger(__name__)


async def run_grading(
    assignment_name: str, media_id: str | None = None
) -> dict:
    """Run the full grading pipeline.

    Steps:
        1. Download zip from WhatsApp (if media_id provided)
        2. Upload zip to matagalls via SFTP
        3. Unzip on remote server
        4. Run autOScan-engine
        5. Pull back JSON results
        6. Parse results
        7. Write to Google Sheets

    Returns:
        dict with 'summary' (str) and 'students' (dict).
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = f"{settings.SSH_REMOTE_DIR}/{assignment_name}_{timestamp}"

    with tempfile.TemporaryDirectory() as tmpdir:
        local_zip = Path(tmpdir) / "submissions.zip"
        local_results = Path(tmpdir) / "results.json"

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

        # Step 2: Create run directory and upload
        logger.info("Creating remote run directory: %s", run_dir)
        run_command(f"mkdir -p {run_dir}")
        remote_zip = f"{run_dir}/submissions.zip"
        upload_file(str(local_zip), remote_zip)

        # Step 3: Unzip on remote
        logger.info("Unzipping on remote server")
        stdout, stderr, exit_code = run_command(f"cd {run_dir} && unzip -o submissions.zip")
        if exit_code != 0:
            logger.error("Unzip failed: %s", stderr)
            return {"summary": f"Failed to unzip submissions: {stderr}", "students": {}}

        # Step 4: Run autOScan-engine
        logger.info("Running autOScan-engine")
        stdout, stderr, exit_code = run_command(
            f"cd {run_dir} && autoscan-engine grade --output results.json ."
        )
        if exit_code != 0:
            logger.error("Engine failed: %s", stderr)
            return {"summary": f"Grading engine error: {stderr}", "students": {}}

        # Step 5: Pull results
        remote_results = f"{run_dir}/results.json"
        download_file(remote_results, str(local_results))

        # Step 6: Parse results
        results_data = json.loads(local_results.read_text())
        students = _parse_results(results_data)

        # Step 7: Write to Google Sheets
        await write_grades(settings.GOOGLE_SHEETS_ID, assignment_name, list(students.values()))
        logger.info("Grading complete for %s: %d students", assignment_name, len(students))

        summary = _build_summary(assignment_name, students)
        return {"summary": summary, "students": students}


def _parse_results(data: dict) -> dict[str, dict]:
    """Parse autOScan-engine JSON output into a student dict.

    TODO: Adjust parsing based on actual engine output format.
    """
    students = {}
    for entry in data.get("results", []):
        sid = entry.get("student_id", "unknown")
        students[sid] = {
            "student_id": sid,
            "name": entry.get("name", ""),
            "grade": entry.get("grade", 0),
            "compilation": entry.get("compilation", ""),
            "tests_passed": entry.get("tests_passed", ""),
            "banned_functions": entry.get("banned_functions", ""),
            "similarity_score": entry.get("similarity_score", ""),
            "notes": entry.get("notes", ""),
        }
    return students


def _build_summary(assignment_name: str, students: dict[str, dict]) -> str:
    """Build a human-readable summary of grading results."""
    if not students:
        return f"No results for {assignment_name}."

    grades = [s["grade"] for s in students.values() if isinstance(s.get("grade"), (int, float))]
    avg = sum(grades) / len(grades) if grades else 0
    passed = sum(1 for g in grades if g >= 5)

    lines = [
        f"Grading complete for *{assignment_name}*",
        f"Students: {len(students)}",
        f"Average grade: {avg:.1f}",
        f"Passed (>= 5): {passed}/{len(grades)}",
    ]
    return "\n".join(lines)
