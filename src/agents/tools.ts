import { tool } from "@openai/agents";

import type { UploadedAttachment } from "@/lib/chat/message-converters";
import {
  runEngineAiDetectionAnalyze,
  runEngineGrade,
  runEngineSimilarityAnalyze,
} from "@/lib/engine/client";
import {
  studentsFromResult,
  type StudentRow,
} from "@/lib/grading";
import {
  getLatestRunId,
  getGradingSession,
  getStoredFileByKey,
  saveLatestRunId,
  saveGradingSession,
  type StoredGradingSession,
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
};

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
type FollowupToolName = "check_similarity" | "check_ai_detection";

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
        "Optional run id. The tool always uses the latest graded run in this chat context.",
      type: "string",
    },
  },
  required: [],
  type: "object",
};

function pickStringArg(args: unknown, ...keys: string[]) {
  if (!isRecord(args)) {
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

    const normalizedUserId = normalizeUserId(userId);
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

    const userId = normalizeUserId(runContext?.context.userId);
    const file = await attachmentToFile(attachment, userId);
    const rawResult = await runEngineGrade(assignmentName, file);
    if (!isRecord(rawResult)) {
      return {
        message: "Grading returned an invalid engine response. Please try again.",
      };
    }
    const runId = pickStringArg(rawResult, "run_id", "runId");
    if (!runId) {
      return {
        message: "Grading finished but no run_id was returned by the engine.",
      };
    }

    const now = new Date().toISOString();

    await saveGradingSession(userId, {
      assignmentName,
      createdAt: now,
      id: runId,
      result: rawResult,
      updatedAt: now,
      uploads: [],
    });
    await saveLatestRunId(userId, runId);

    const students = studentsFromResult(rawResult);
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

async function latestSession(userId: string) {
  const runId = await getLatestRunId(userId);
  if (!runId) {
    return {
      error: "No graded run is available yet. Ask the user to grade first.",
    } as const;
  }
  const session = await getGradingSession(userId, runId);
  if (!session) {
    return {
      error:
        "The latest graded run is not available in storage. Ask the user to grade again.",
    } as const;
  }
  return { runId, session } as const;
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

function malformedEngineResultMessage(toolName: FollowupToolName) {
  return toolName === "check_similarity"
    ? "Similarity check returned an invalid engine response. Please run the check again."
    : "AI detection returned an invalid engine response. Please run the check again.";
}

function followupFailureMessage(toolName: FollowupToolName, error: unknown) {
  const detail =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "Unexpected tool error.";
  return toolName === "check_similarity"
    ? `Similarity check failed: ${detail}`
    : `AI detection failed: ${detail}`;
}

type FollowupToolConfig = {
  analyze: (runId: string) => Promise<unknown>;
  description: string;
  name: FollowupToolName;
  payloadField: FollowupPayloadField;
  payloadKeys: readonly string[];
};

async function runFollowup(
  runContext: { context: GradingContext } | undefined,
  config: FollowupToolConfig,
) {
  const userId = normalizeUserId(runContext?.context.userId);
  const loaded = await latestSession(userId);
  if ("error" in loaded) {
    return { message: loaded.error };
  }
  const { runId, session } = loaded;

  const rawResult = await config.analyze(runId);
  if (!isRecord(rawResult)) {
    return {
      assignmentName: session.assignmentName,
      message: malformedEngineResultMessage(config.name),
      runId,
      summary: { hasReport: false },
    };
  }
  const now = new Date().toISOString();
  await saveGradingSession(userId, {
    ...session,
    result: {
      ...session.result,
      ...rawResult,
    },
    updatedAt: now,
  });

  const payload = pickFollowupResult(rawResult, ...config.payloadKeys);

  return {
    assignmentName: session.assignmentName,
    runId,
    summary: summarizeFollowupPayload(config.payloadField, payload),
  };
}

function createFollowupTool(config: FollowupToolConfig) {
  return tool<typeof followupSchema, GradingContext>({
    description: config.description,
    name: config.name,
    parameters: followupSchema,
    strict: false,
    execute: async (_args, runContext) => {
      try {
        return await runFollowup(runContext, config);
      } catch (error) {
        return {
          message: followupFailureMessage(config.name, error),
          runId: null,
          summary: { hasReport: false },
        };
      }
    },
    timeoutBehavior: "error_as_result",
    timeoutMs: 240_000,
  });
}

export const checkSimilarity = createFollowupTool({
  analyze: (runId) => runEngineSimilarityAnalyze(runId, { includeSpans: true, minScore: 40 }),
  description:
    "Check pairwise similarity across submissions in the latest graded run to spot potential copies.",
  name: "check_similarity",
  payloadField: "similarity",
  payloadKeys: ["similarity", "similarity_report", "similarityReport"],
});

export const checkAiDetection = createFollowupTool({
  analyze: (runId) => runEngineAiDetectionAnalyze(runId, { includeSpans: true, minScore: 40 }),
  description:
    "Run an AI-detection pass on submissions in the latest graded run to flag likely AI-generated code.",
  name: "check_ai_detection",
  payloadField: "aiDetection",
  payloadKeys: ["ai_detection", "aiDetection", "ai_detection_report"],
});
