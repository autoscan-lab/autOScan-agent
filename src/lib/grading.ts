import type { EngineResult, StoredGradingSession } from "@/lib/r2-storage";

/**
 * Canonical shape the UI + tool outputs agree on. The engine returns a loose
 * record; we flatten it here once so no consumer has to re-normalize.
 */
export type StudentRow = {
  studentId: string;
  status: string | null;
  grade: number | null;
  compileOk: boolean | null;
  testsPassed: string | null;
  bannedCount: number | null;
  notes: string | null;
  sourceText: string | null;
};

export type LatestGrading = {
  assignmentName: string | null;
  students: StudentRow[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function testsPassedOf(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  const passed = num(value.passed);
  const total = num(value.total);
  return passed !== null && total !== null ? `${passed}/${total}` : null;
}

function studentIdOf(raw: Record<string, unknown>): string {
  return str(raw.student_id) ?? str(raw.id) ?? "unknown";
}

export function toStudentRow(raw: Record<string, unknown>): StudentRow {
  return {
    bannedCount: num(raw.banned_count),
    compileOk: bool(raw.compile_ok),
    grade: num(raw.manual_grade) ?? num(raw.grade),
    notes: str(raw.manual_reason) ?? str(raw.notes),
    sourceText: str(raw.source_code),
    status: str(raw.status),
    studentId: studentIdOf(raw),
    testsPassed: testsPassedOf(raw.tests),
  };
}

export function studentsFromResult(result: EngineResult | undefined): StudentRow[] {
  const rows = result?.results;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.filter(isRecord).map(toStudentRow);
}

export function latestFromSession(
  session: StoredGradingSession | undefined,
): LatestGrading {
  if (!session) {
    return { assignmentName: null, students: [] };
  }
  return {
    assignmentName: session.assignmentName ?? null,
    students: studentsFromResult(session.result),
  };
}

/** Find and return the raw engine record for a student id (for mutation). */
export function findRawStudent(
  session: StoredGradingSession | undefined,
  studentId: string,
): Record<string, unknown> | undefined {
  const rows = session?.result?.results;
  if (!Array.isArray(rows)) {
    return undefined;
  }
  return rows
    .filter(isRecord)
    .find((row) => studentIdOf(row) === studentId);
}
