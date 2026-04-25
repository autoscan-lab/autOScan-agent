import { randomUUID } from "node:crypto";

import { tool } from "@openai/agents";

import type { UploadedAttachment } from "@/lib/chat/message-converters";
import { runEngineGrade } from "@/lib/engine/client";
import {
  studentsFromResult,
  type StudentRow,
} from "@/lib/grading";
import {
  getStoredFileByKey,
  saveGradingSession,
  saveUploadedFile,
  type StoredGradingSession,
  type StoredUpload,
  userStorageKey,
} from "@/lib/storage";
import { normalizeUserId } from "@/lib/auth";

export type GradingContext = {
  attachments?: UploadedAttachment[];
  userId?: string;
};

type AttachmentFile = {
  bytes: Buffer;
  filename: string;
  mediaType: string;
  storedUpload?: StoredUpload;
};

type ToolArgs = Record<string, unknown>;
type ToolParameter = {
  description?: string;
  type: "number" | "string";
};
type NonStrictToolSchema = {
  additionalProperties: true;
  properties: Record<string, ToolParameter>;
  required: string[];
  type: "object";
};

const gradeSubmissionsSchema: NonStrictToolSchema = {
  additionalProperties: true,
  properties: {
    assignment_name: {
      description: "Assignment name in snake_case (for example S0).",
      type: "string",
    },
  },
  required: ["assignment_name"],
  type: "object",
};

function isToolArgs(value: unknown): value is ToolArgs {
  return typeof value === "object" && value !== null;
}

function pickStringArg(args: unknown, ...keys: string[]) {
  if (!isToolArgs(args)) {
    return undefined;
  }

  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized) {
        return normalized;
      }
    }
  }

  return undefined;
}

function contextUserId(userId?: string) {
  return normalizeUserId(userId);
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
      storedUpload: {
        contentType:
          object.contentType ?? attachment.mediaType ?? "application/zip",
        filename,
        key: object.key,
        sizeBytes: object.bytes.byteLength,
      },
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

/** Keep streamed tool output small; the full run is loaded from R2 by run id. */
function prune(row: StudentRow) {
  const entries = Object.entries(row).filter(
    ([key, value]) =>
      value !== null &&
      !["bannedHits", "sourceFiles", "sourceText", "tests"].includes(key),
  );
  return Object.fromEntries(entries) as Partial<StudentRow>;
}

export const gradeSubmissions = tool<
  typeof gradeSubmissionsSchema,
  GradingContext
>({
  description:
    "Grade student submissions from the zip file the user attached to this chat.",
  name: "grade_submissions",
  parameters: gradeSubmissionsSchema,
  strict: false,
  execute: async (args, runContext) => {
    const assignmentName = pickStringArg(args, "assignment_name");
    if (!assignmentName) {
      return {
        message:
          "Missing assignment name. Ask the user to provide it (for example S0).",
      };
    }

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
    const upload =
      file.storedUpload ??
      (await saveUploadedFile({
        bytes: file.bytes,
        contentType: file.mediaType,
        filename: file.filename,
        runId,
        userId,
      }));
    const result = await runEngineGrade(assignmentName, file);
    const now = new Date().toISOString();

    await rememberSession(userId, {
      assignmentName,
      createdAt: now,
      id: runId,
      result,
      updatedAt: now,
      uploads: [upload],
    });

    const students = studentsFromResult(result);
    return {
      assignmentName,
      runId,
      studentCount: students.length,
      students: students.map(prune),
    };
  },
  timeoutBehavior: "error_as_result",
  timeoutMs: 240_000,
});
