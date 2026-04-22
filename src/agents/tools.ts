import { randomUUID } from "node:crypto";

import { tool } from "@openai/agents";
import ExcelJS from "exceljs";
import { z } from "zod";

import type { UploadedAttachment } from "@/lib/message-converters";
import {
  findRawStudent,
  studentsFromResult,
  toStudentRow,
  type StudentRow,
} from "@/lib/grading";
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

const engineHeaders = () => {
  const headers: Record<string, string> = {};
  const secret = process.env.ENGINE_SECRET?.trim();

  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
    headers["X-Autoscan-Secret"] = secret;
  }

  return headers;
};

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

function pickZipAttachment(
  attachments: UploadedAttachment[] | undefined,
): UploadedAttachment | undefined {
  const candidates = (attachments ?? []).filter(
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
      headers: engineHeaders(),
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
    headers: engineHeaders(),
    method: "POST",
    signal: AbortSignal.timeout(60_000),
  });

  return parseEngineResponse(response);
}

async function currentStudents(userId?: string): Promise<StudentRow[]> {
  return studentsFromResult((await latestSession(userId))?.result);
}

/** Drop fields that serialize to null so tool outputs stay lean for the LLM. */
function prune(row: StudentRow) {
  const entries = Object.entries(row).filter(
    ([key, value]) => value !== null && key !== "sourceText",
  );
  return Object.fromEntries(entries) as Partial<Omit<StudentRow, "sourceText">>;
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
    { header: "Student ID", key: "studentId", width: 24 },
    { header: "Status", key: "status", width: 16 },
    { header: "Grade", key: "grade", width: 12 },
    { header: "Compile OK", key: "compileOk", width: 14 },
    { header: "Tests Passed", key: "testsPassed", width: 16 },
    { header: "Banned Count", key: "bannedCount", width: 16 },
    { header: "Notes", key: "notes", width: 42 },
  ];

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = { vertical: "middle" };

  for (const student of students) {
    worksheet.addRow({
      bannedCount: student.bannedCount ?? "",
      compileOk:
        typeof student.compileOk === "boolean" ? student.compileOk : "",
      grade: student.grade ?? "",
      notes: student.notes ?? "",
      status: student.status ?? "",
      studentId: student.studentId,
      testsPassed: student.testsPassed ?? "",
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
  }>,
  GradingContext
>({
  description:
    "Grade student submissions from the zip file the user attached to this chat.",
  name: "grade_submissions",
  parameters: z.object({
    assignment_name: z
      .string()
      .describe("The assignment name, for example S0."),
  }),
  execute: async ({ assignment_name }, runContext) => {
    const attachment = pickZipAttachment(runContext?.context.attachments);

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

    const students = studentsFromResult(result);
    return {
      assignmentName: assignment_name,
      studentCount: students.length,
      students: students.map(prune),
    };
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

    return { students: students.map(prune) };
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
    const student = students.find((row) => row.studentId === student_id);

    if (!student) {
      return {
        message: `Student '${student_id}' was not found in the latest run.`,
      };
    }

    return student;
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
    const rawStudent = findRawStudent(session, student_id);

    if (!session || !rawStudent) {
      return {
        message: `Student '${student_id}' was not found in the latest run.`,
      };
    }

    rawStudent.manual_grade = new_grade;
    rawStudent.manual_reason = reason;
    session.updatedAt = new Date().toISOString();
    await rememberSession(userId, session);

    return {
      message: "Grade adjusted and saved.",
      student: prune(toStudentRow(rawStudent)),
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
      downloadUrl: `/api/exports/${metadata.id}`,
      filename: metadata.filename,
    };
  },
});
