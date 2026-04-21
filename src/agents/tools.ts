import { randomUUID } from "node:crypto";

import { tool } from "@openai/agents";
import ExcelJS from "exceljs";
import { z } from "zod";

import type { UploadedAttachment } from "@/lib/message-converters";
import {
  getStoredFileByKey,
  getLatestGradingSession,
  saveExportFile,
  saveGradingSession,
  saveUploadedFile,
  type EngineResult,
  type StoredGradingSession,
} from "@/lib/r2-storage";
import { userStorageKey } from "@/lib/storage-keys";

export type GradingContext = {
  attachments?: UploadedAttachment[];
  userId?: string;
};

type StudentRow = {
  student_id: string;
  status?: string;
  grade?: number | null;
  compile_ok?: boolean;
  tests_passed?: string;
  banned_count?: number;
  notes?: string;
  raw: Record<string, unknown>;
};

type AttachmentFile = {
  bytes: Buffer;
  filename: string;
  mediaType: string;
};

const xlsxContentType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const engineBaseUrl = () => {
  const url = process.env.ENGINE_URL?.trim();
  if (!url) {
    throw new Error("ENGINE_URL is not configured.");
  }
  return url.replace(/\/$/, "");
};

const engineHeaders = (json = true) => {
  const headers: Record<string, string> = {};
  const secret = process.env.ENGINE_SECRET?.trim();

  if (json) {
    headers["Content-Type"] = "application/json";
  }

  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
    headers["X-Autoscan-Secret"] = secret;
  }

  return headers;
};

async function engineJson(path: string, body: object) {
  const response = await fetch(`${engineBaseUrl()}${path}`, {
    body: JSON.stringify(body),
    headers: engineHeaders(true),
    method: "POST",
    signal: AbortSignal.timeout(60_000),
  });

  return parseEngineResponse(response);
}

async function parseEngineResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => undefined)
    : await response.text();

  if (!response.ok) {
    const detail =
      typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
    throw new Error(`Engine request failed (${response.status}): ${detail}`);
  }

  return payload as EngineResult;
}

function contextUserId(userId?: string) {
  return userId?.trim() || "anonymous";
}

async function latestSession(userId?: string) {
  return getLatestGradingSession(contextUserId(userId));
}

async function rememberSession(
  userId: string | undefined,
  session: StoredGradingSession,
) {
  await saveGradingSession(contextUserId(userId), session);
}

function selectedAttachment(
  argsAttachmentUrl: string | undefined,
  contextAttachments: UploadedAttachment[] | undefined,
): UploadedAttachment | undefined {
  if (argsAttachmentUrl) {
    return {
      filename: "submissions.zip",
      mediaType: "application/zip",
      url: argsAttachmentUrl,
    };
  }

  const candidates = (contextAttachments ?? []).filter(
    (attachment) =>
      typeof attachment.url === "string" &&
      attachment.url.trim() !== "" &&
      !attachment.url.startsWith("about:blank"),
  );

  return (
    [...candidates]
      .reverse()
      .find((attachment) =>
        (attachment.filename ?? attachment.mediaType)
          .toLowerCase()
          .includes("zip"),
      ) ?? candidates.at(-1)
  );
}

async function attachmentToFile(
  attachment: UploadedAttachment,
  userId?: string,
): Promise<AttachmentFile> {
  const filename = attachment.filename ?? "submissions.zip";

  if (attachment.url.startsWith("r2://")) {
    const objectKey = attachment.url.slice("r2://".length).trim();
    if (!objectKey) {
      throw new Error("Uploaded attachment reference is invalid.");
    }

    const normalizedUserId = contextUserId(userId);
    const expectedUserKey = userStorageKey(normalizedUserId);
    if (!objectKey.includes(`/${expectedUserKey}/`)) {
      throw new Error("Uploaded attachment does not belong to this user.");
    }

    const object = await getStoredFileByKey(objectKey);
    if (!object) {
      throw new Error("Uploaded attachment was not found. Please re-upload it.");
    }

    return {
      bytes: object.bytes,
      filename,
      mediaType: object.contentType ?? attachment.mediaType ?? "application/zip",
    };
  }

  if (attachment.url.startsWith("data:")) {
    const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(attachment.url);
    if (!match) {
      throw new Error("Uploaded attachment data URL is invalid.");
    }

    const mediaType = match[1] || attachment.mediaType || "application/zip";
    const isBase64 = Boolean(match[2]);
    const data = match[3];
    const bytes = isBase64
      ? Buffer.from(data, "base64")
      : Buffer.from(decodeURIComponent(data));

    return { bytes, filename, mediaType };
  }

  const response = await fetch(attachment.url, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`Could not download attachment (${response.status}).`);
  }

  const mediaType =
    response.headers.get("content-type") ??
    attachment.mediaType ??
    "application/zip";
  const bytes = Buffer.from(await response.arrayBuffer());

  return { bytes, filename, mediaType };
}

async function setupAssignment(assignmentName: string) {
  return fetch(
    `${engineBaseUrl()}/setup/${encodeURIComponent(assignmentName)}`,
    {
      headers: engineHeaders(false),
      method: "POST",
      signal: AbortSignal.timeout(60_000),
    },
  );
}

async function gradeWithCurrentEngine(
  assignmentName: string,
  attachment: AttachmentFile,
) {
  const setupResponse = await setupAssignment(assignmentName);
  await parseEngineResponse(setupResponse);

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(attachment.bytes)], {
    type: attachment.mediaType,
  });
  formData.set("file", blob, attachment.filename);

  const response = await fetch(`${engineBaseUrl()}/grade`, {
    body: formData,
    headers: engineHeaders(false),
    method: "POST",
    signal: AbortSignal.timeout(60_000),
  });

  return parseEngineResponse(response);
}

function resultsFrom(session: StoredGradingSession | undefined) {
  const results = session?.result.results;
  return Array.isArray(results) ? results.filter(isRecord) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberFrom(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boolFrom(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function stringFrom(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function testsPassed(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const passed = numberFrom(value.passed);
  const total = numberFrom(value.total);
  if (passed === null || total === null) {
    return undefined;
  }

  return `${passed}/${total}`;
}

function toStudentRow(result: Record<string, unknown>): StudentRow {
  const studentId =
    stringFrom(result.student_id) ?? stringFrom(result.id) ?? "unknown";
  const grade = numberFrom(result.manual_grade) ?? numberFrom(result.grade);

  return {
    banned_count: numberFrom(result.banned_count) ?? undefined,
    compile_ok: boolFrom(result.compile_ok),
    grade,
    notes: stringFrom(result.manual_reason) ?? stringFrom(result.notes),
    raw: result,
    status: stringFrom(result.status),
    student_id: studentId,
    tests_passed: testsPassed(result.tests),
  };
}

async function currentStudents(userId?: string) {
  return resultsFrom(await latestSession(userId)).map(toStudentRow);
}

async function buildGradesWorkbook(
  assignmentName: string | undefined,
  students: StudentRow[],
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "autOScan";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Grades");
  worksheet.columns = [
    { header: "Student ID", key: "student_id", width: 24 },
    { header: "Status", key: "status", width: 16 },
    { header: "Grade", key: "grade", width: 12 },
    { header: "Compile OK", key: "compile_ok", width: 14 },
    { header: "Tests Passed", key: "tests_passed", width: 16 },
    { header: "Banned Count", key: "banned_count", width: 16 },
    { header: "Notes", key: "notes", width: 42 },
  ];

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = { vertical: "middle" };

  for (const student of students) {
    worksheet.addRow({
      banned_count: student.banned_count ?? "",
      compile_ok:
        typeof student.compile_ok === "boolean" ? student.compile_ok : "",
      grade: student.grade ?? "",
      notes: student.notes ?? "",
      status: student.status ?? "",
      student_id: student.student_id,
      tests_passed: student.tests_passed ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const safeAssignment =
    (assignmentName ?? "grades")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "grades";

  return {
    bytes: Buffer.from(buffer),
    filename: `${safeAssignment}.xlsx`,
  };
}

export const gradeSubmissions = tool<
  z.ZodObject<{
    assignment_name: z.ZodString;
    attachment_url: z.ZodOptional<z.ZodString>;
  }>,
  GradingContext
>({
  description: "Grade student submissions from an uploaded zip file.",
  name: "grade_submissions",
  parameters: z.object({
    assignment_name: z
      .string()
      .describe("The assignment name, for example S0."),
    attachment_url: z
      .string()
      .optional()
      .describe("Optional hosted URL or data URL for the submitted zip file."),
  }),
  execute: async ({ assignment_name, attachment_url }, runContext) => {
    const attachment = selectedAttachment(
      attachment_url,
      runContext?.context.attachments,
    );

    if (!attachment) {
      return {
        message:
          "No zip file was attached. Ask the user to attach a submissions zip file and include the assignment name.",
      };
    }

    const userId = contextUserId(runContext?.context.userId);
    const runId = randomUUID();
    const file = await attachmentToFile(attachment, userId);
    const upload = await saveUploadedFile({
      bytes: file.bytes,
      contentType: file.mediaType,
      filename: file.filename,
      runId,
      userId,
    });
    const result = await gradeWithCurrentEngine(assignment_name, file);
    const now = new Date().toISOString();

    await rememberSession(userId, {
      assignmentName: assignment_name,
      createdAt: now,
      id: runId,
      result,
      updatedAt: now,
      uploads: [upload],
    });

    return result;
  },
  timeoutBehavior: "error_as_result",
  timeoutMs: 240_000,
});

export const listStudents = tool<
  z.ZodObject<Record<string, never>>,
  GradingContext
>({
  description:
    "List all graded students with their scores from the latest run.",
  name: "list_students",
  parameters: z.object({}),
  execute: async (_args, runContext) => {
    const students = await currentStudents(runContext?.context.userId);
    if (students.length === 0) {
      return {
        message:
          "No graded students are available in this chat session yet. Run grade_submissions first.",
      };
    }

    return { students };
  },
});

export const showStudent = tool<
  z.ZodObject<{ student_id: z.ZodString }>,
  GradingContext
>({
  description:
    "Show detailed results for a specific student from the latest run.",
  name: "show_student",
  parameters: z.object({ student_id: z.string() }),
  execute: async ({ student_id }, runContext) => {
    const students = await currentStudents(runContext?.context.userId);
    const student = students.find((row) => row.student_id === student_id);

    if (!student) {
      return {
        message: `Student '${student_id}' was not found in the latest run.`,
      };
    }

    return student.raw;
  },
});

export const bumpGrade = tool<
  z.ZodObject<{
    student_id: z.ZodString;
    new_grade: z.ZodNumber;
    reason: z.ZodString;
  }>,
  GradingContext
>({
  description:
    "Manually adjust a student's grade with a reason in the latest session.",
  name: "bump_grade",
  parameters: z.object({
    new_grade: z.number(),
    reason: z.string(),
    student_id: z.string(),
  }),
  execute: async ({ student_id, new_grade, reason }, runContext) => {
    const userId = contextUserId(runContext?.context.userId);
    const session = await latestSession(userId);
    const results = resultsFrom(session);
    const student = results.find(
      (result) =>
        (stringFrom(result.student_id) ?? stringFrom(result.id)) === student_id,
    );

    if (!session || !student) {
      return {
        message: `Student '${student_id}' was not found in the latest run.`,
      };
    }

    student.manual_grade = new_grade;
    student.manual_reason = reason;
    session.updatedAt = new Date().toISOString();
    await rememberSession(userId, session);

    return {
      message: "Grade adjusted and saved to durable storage.",
      student: toStudentRow(student),
    };
  },
});

export const exportGrades = tool<
  z.ZodObject<Record<string, never>>,
  GradingContext
>({
  description: "Export all grades as an Excel file and return a download URL.",
  name: "export_grades",
  parameters: z.object({}),
  execute: async (_args, runContext) => {
    const userId = contextUserId(runContext?.context.userId);
    const session = await latestSession(userId);
    const students = await currentStudents(userId);

    if (students.length === 0) {
      return {
        message:
          "No grades are available to export in this chat session yet. Run grade_submissions first.",
      };
    }

    const exportFile = await buildGradesWorkbook(
      session?.assignmentName,
      students,
    );
    const metadata = await saveExportFile({
      bytes: exportFile.bytes,
      contentType: xlsxContentType,
      filename: exportFile.filename,
      runId: session?.id,
      userId,
    });

    return {
      download_url: `/api/exports/${metadata.id}`,
      expires_in: "Stored in R2 until removed.",
      filename: metadata.filename,
    };
  },
});

export async function callFutureEngineEndpoint(path: string, body: object) {
  return engineJson(path, body);
}
