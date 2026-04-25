import { randomUUID } from "node:crypto";

import { tool } from "@openai/agents";

import type { UploadedAttachment } from "@/lib/chat/message-converters";
import {
  type EngineGradeOptions,
  runEngineGrade,
} from "@/lib/engine/client";
import {
  studentsFromResult,
  type StudentRow,
} from "@/lib/grading";
import {
  getGradingSession,
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
type FollowupPayloadField = "similarity" | "aiDetection";

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

const followupSchema: NonStrictToolSchema = {
  additionalProperties: true,
  properties: {
    run_id: {
      description:
        "The runId returned by a previous grade_submissions call in this conversation.",
      type: "string",
    },
  },
  required: ["run_id"],
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
      ![
        "bannedHits",
        "cFiles",
        "compileTimeMs",
        "compileTimeout",
        "compilerError",
        "exitCode",
        "notes",
        "path",
        "sourceFiles",
        "sourceText",
        "tests",
        "testsPassed",
      ].includes(key),
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

async function loadSessionUpload(userId: string, runId: string) {
  const session = await getGradingSession(userId, runId);
  if (!session) {
    return { error: "Run not found. Ask the user which run to inspect." } as const;
  }

  const upload = session.uploads[0];
  if (!upload) {
    return { error: "Stored run has no upload to re-analyze." } as const;
  }

  const stored = await getStoredFileByKey(upload.key);
  if (!stored) {
    return {
      error:
        "The original zip is no longer available. Ask the user to re-upload it.",
    } as const;
  }

  return {
    file: {
      bytes: stored.bytes,
      filename: upload.filename,
      mediaType: stored.contentType ?? upload.contentType ?? "application/zip",
    },
    session,
  } as const;
}

function pickFollowupResult(
  result: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    const value = result[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flaggedCount(values: unknown[]) {
  return values.reduce<number>(
    (count, value) => count + (isRecord(value) && value.flagged === true ? 1 : 0),
    0,
  );
}

function summarizeFollowupPayload(
  payloadField: FollowupPayloadField,
  payload: unknown,
) {
  if (!isRecord(payload)) {
    return { hasReport: false };
  }

  if (payloadField === "similarity") {
    const pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
    return {
      flaggedPairs: flaggedCount(pairs),
      hasReport: true,
      pairCount: pairs.length,
    };
  }

  const submissions = Array.isArray(payload.submissions) ? payload.submissions : [];
  return {
    flaggedSubmissions: flaggedCount(submissions),
    hasReport: true,
    submissionCount: submissions.length,
  };
}

async function runFollowup(
  args: unknown,
  runContext: { context: GradingContext } | undefined,
  options: EngineGradeOptions,
  payloadKeys: readonly string[],
  payloadField: FollowupPayloadField,
) {
  const runId = pickStringArg(args, "run_id");
  if (!runId) {
    return {
      message:
        "Missing run_id. Use the runId from the previous grade_submissions call.",
    };
  }

  const userId = contextUserId(runContext?.context.userId);
  const loaded = await loadSessionUpload(userId, runId);
  if ("error" in loaded) {
    return { message: loaded.error };
  }

  const result = (await runEngineGrade(
    loaded.session.assignmentName,
    loaded.file,
    options,
  )) as Record<string, unknown>;

  const now = new Date().toISOString();
  await rememberSession(userId, {
    ...loaded.session,
    result,
    updatedAt: now,
  });

  const payload = pickFollowupResult(result, ...payloadKeys);

  return {
    [payloadField]: payload,
    assignmentName: loaded.session.assignmentName,
    runId,
    summary: summarizeFollowupPayload(payloadField, payload),
  };
}

export const checkSimilarity = tool<typeof followupSchema, GradingContext>({
  description:
    "Check pairwise similarity across submissions in a previously graded run to spot potential copies.",
  name: "check_similarity",
  parameters: followupSchema,
  strict: false,
  execute: async (args, runContext) =>
    runFollowup(
      args,
      runContext,
      { includeSimilarity: true },
      ["similarity", "similarity_report", "similarityReport"],
      "similarity",
    ),
  timeoutBehavior: "error_as_result",
  timeoutMs: 240_000,
});

export const checkAiDetection = tool<typeof followupSchema, GradingContext>({
  description:
    "Run an AI-detection pass on submissions in a previously graded run to flag likely AI-generated code.",
  name: "check_ai_detection",
  parameters: followupSchema,
  strict: false,
  execute: async (args, runContext) =>
    runFollowup(
      args,
      runContext,
      { includeAiDetection: true },
      ["ai_detection", "aiDetection", "ai_detection_report"],
      "aiDetection",
    ),
  timeoutBehavior: "error_as_result",
  timeoutMs: 240_000,
});
