import type { EngineResult, StoredGradingSession } from "@/lib/storage";

/**
 * Canonical shape the UI + tool outputs agree on. The engine returns a loose
 * record; we flatten it here once so no consumer has to re-normalize.
 */
export type SourceFile = {
  content: string;
  path: string;
};

export type BannedHit = {
  column: number | null;
  file: string | null;
  functionName: string;
  line: number | null;
  snippet: string | null;
};

export type TestCaseResult = {
  durationMs: number | null;
  exitCode: number | null;
  index: number | null;
  message: string | null;
  name: string | null;
  outputMatch: string | null;
  status: string | null;
};

export type TestSummary = {
  cases: TestCaseResult[];
  compileFailed: number | null;
  failed: number | null;
  missingExpectedOutput: number | null;
  passed: number | null;
  total: number | null;
};

export type StudentRow = {
  bannedCount: number | null;
  bannedHits: BannedHit[];
  cFiles: string[];
  compileOk: boolean | null;
  compileTimeMs: number | null;
  compileTimeout: boolean | null;
  compilerError: string | null;
  exitCode: number | null;
  grade: number | null;
  notes: string | null;
  path: string | null;
  sourceFiles: SourceFile[];
  sourceText: string | null;
  status: string | null;
  studentId: string;
  tests: TestSummary | null;
  testsPassed: string | null;
};

export type GradingRunSummary = {
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

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function studentIdOf(raw: Record<string, unknown>): string {
  return str(raw.student_id) ?? str(raw.id) ?? "unknown";
}

function bannedHitsOf(value: unknown): BannedHit[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): BannedHit[] => {
    if (!isRecord(entry)) {
      return [];
    }
    const functionName = str(entry.function);
    if (!functionName) {
      return [];
    }

    return [
      {
        column: num(entry.column),
        file: str(entry.file),
        functionName,
        line: num(entry.line),
        snippet: str(entry.snippet),
      },
    ];
  });
}

function testCasesOf(value: unknown): TestCaseResult[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): TestCaseResult[] => {
    if (!isRecord(entry)) {
      return [];
    }

    return [
      {
        durationMs: num(entry.duration_ms),
        exitCode: num(entry.exit_code),
        index: num(entry.index),
        message: str(entry.message),
        name: str(entry.name),
        outputMatch: str(entry.output_match),
        status: str(entry.status),
      },
    ];
  });
}

function testsOf(value: unknown): TestSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    cases: testCasesOf(value.cases),
    compileFailed: num(value.compile_failed),
    failed: num(value.failed),
    missingExpectedOutput: num(value.missing_expected_output),
    passed: num(value.passed),
    total: num(value.total),
  };
}

function sourceFilesOf(value: unknown): SourceFile[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): SourceFile[] => {
    if (!isRecord(entry)) {
      return [];
    }
    const content = str(entry.content) ?? str(entry.source_code);
    const path = str(entry.path) ?? str(entry.file);
    if (!content || !path) {
      return [];
    }

    return [{ content, path }];
  });
}

function sourceTextOf(raw: Record<string, unknown>, sourceFiles: SourceFile[]) {
  const sourceText = str(raw.source_code);
  if (sourceText || sourceFiles.length === 0) {
    return sourceText;
  }

  return sourceFiles
    .map((sourceFile) =>
      sourceFiles.length === 1
        ? sourceFile.content
        : `// ${sourceFile.path}\n${sourceFile.content}`,
    )
    .join("\n\n");
}

export function toStudentRow(raw: Record<string, unknown>): StudentRow {
  const sourceFiles = sourceFilesOf(raw.source_files);

  return {
    bannedCount: num(raw.banned_count),
    bannedHits: bannedHitsOf(raw.banned_hits),
    cFiles: stringArray(raw.c_files),
    compileOk: bool(raw.compile_ok),
    compileTimeMs: num(raw.compile_time_ms),
    compileTimeout: bool(raw.compile_timeout),
    compilerError: str(raw.stderr),
    exitCode: num(raw.exit_code),
    grade: num(raw.grade),
    notes: str(raw.notes),
    path: str(raw.path),
    sourceFiles,
    sourceText: sourceTextOf(raw, sourceFiles),
    status: str(raw.status),
    studentId: studentIdOf(raw),
    tests: testsOf(raw.tests),
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

export function gradingRunFromSession(
  session: StoredGradingSession | undefined,
): GradingRunSummary {
  if (!session) {
    return { assignmentName: null, students: [] };
  }

  return {
    assignmentName: session.assignmentName ?? null,
    students: studentsFromResult(session.result),
  };
}
