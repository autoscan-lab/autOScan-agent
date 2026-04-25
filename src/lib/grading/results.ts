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
  actualOutput: string | null;
  diffLines: TestDiffLine[];
  durationMs: number | null;
  exitCode: number | null;
  expectedOutput: string | null;
  index: number | null;
  message: string | null;
  name: string | null;
  outputMatch: string | null;
  status: string | null;
  stderr: string | null;
  stdout: string | null;
};

export type TestDiffLine = {
  content: string;
  lineNum: number | null;
  type: string;
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
  aiDetectionReport: unknown | null;
  assignmentName: string | null;
  runId: string | null;
  similarityReport: unknown | null;
  students: StudentRow[];
};

const similarityResultKeys = [
  "similarity",
  "similarity_report",
  "similarityReport",
] as const;
const aiDetectionResultKeys = [
  "ai_detection",
  "aiDetection",
  "ai_detection_report",
] as const;

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

function record(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
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
  const submission = record(raw.submission);
  return str(submission?.id) ?? "unknown";
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
        actualOutput: str(entry.actual_output),
        diffLines: testDiffLinesOf(entry.diff_lines),
        durationMs: num(entry.duration_ms),
        exitCode: num(entry.exit_code),
        expectedOutput: str(entry.expected_output),
        index: num(entry.index),
        message: str(entry.message),
        name: str(entry.name),
        outputMatch: str(entry.output_match),
        status: str(entry.status),
        stderr: str(entry.stderr),
        stdout: str(entry.stdout),
      },
    ];
  });
}

function testDiffLinesOf(value: unknown): TestDiffLine[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): TestDiffLine[] => {
    if (!isRecord(entry)) {
      return [];
    }
    const type = str(entry.type);
    const content = str(entry.content);
    if (!type || content === null) {
      return [];
    }

    return [
      {
        content,
        lineNum: num(entry.line_num),
        type,
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
    const content = str(entry.content);
    const path = str(entry.name);
    if (!content || !path) {
      return [];
    }

    return [{ content, path }];
  });
}

function sourceTextOf(sourceFiles: SourceFile[]) {
  if (sourceFiles.length === 0) {
    return null;
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
  const submission = record(raw.submission);
  const compile = record(raw.compile);
  const scan = record(raw.scan);
  const sourceFiles = sourceFilesOf(raw.source_files);
  const bannedHits = bannedHitsOf(scan?.hits);

  return {
    bannedCount: bannedHits.length,
    bannedHits,
    cFiles: stringArray(submission?.c_files),
    compileOk: bool(compile?.ok),
    compileTimeMs: num(compile?.duration_ms),
    compileTimeout: bool(compile?.timed_out),
    compilerError: str(compile?.stderr),
    exitCode: num(compile?.exit_code),
    grade: num(raw.grade),
    notes: str(raw.notes),
    path: str(submission?.path),
    sourceFiles,
    sourceText: sourceTextOf(sourceFiles),
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

function pickResultField(
  result: EngineResult | undefined,
  keys: readonly string[],
) {
  if (!result) {
    return null;
  }
  for (const key of keys) {
    const value = result[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return null;
}

export function gradingRunFromSession(
  session: StoredGradingSession | undefined,
): GradingRunSummary {
  if (!session) {
    return {
      aiDetectionReport: null,
      assignmentName: null,
      runId: null,
      similarityReport: null,
      students: [],
    };
  }

  return {
    aiDetectionReport: pickResultField(session.result, aiDetectionResultKeys),
    assignmentName: session.assignmentName ?? null,
    runId: session.id ?? null,
    similarityReport: pickResultField(session.result, similarityResultKeys),
    students: studentsFromResult(session.result),
  };
}
