"""Groq-compatible tool schemas for the LLM dispatcher."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "grade_submissions",
            "description": "Grade student submissions for a given assignment. Triggers the full grading pipeline: upload zip, run autOScan-engine, parse results, and write an Excel workbook.",
            "parameters": {
                "type": "object",
                "properties": {
                    "assignment_name": {
                        "type": "string",
                        "description": "Name of the assignment to grade (e.g. 'lab1', 'lab2-threads').",
                    },
                },
                "required": ["assignment_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "show_student",
            "description": "Show a specific student's grades and engine output summary.",
            "parameters": {
                "type": "object",
                "properties": {
                    "student_id": {
                        "type": "string",
                        "description": "The student identifier.",
                    },
                },
                "required": ["student_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "bump_grade",
            "description": "Update a student's grade in the exported Excel workbook with a reason.",
            "parameters": {
                "type": "object",
                "properties": {
                    "student_id": {
                        "type": "string",
                        "description": "The student identifier.",
                    },
                    "new_grade": {
                        "type": "number",
                        "description": "The new grade value.",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Reason for the grade change.",
                    },
                },
                "required": ["student_id", "new_grade", "reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_students",
            "description": "List all students in the current grading session with their grades.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "export_grades",
            "description": "Confirm grades are written to the exported Excel workbook and return its path.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "show_rubric",
            "description": "Show the current rubric being applied for grading.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
]
