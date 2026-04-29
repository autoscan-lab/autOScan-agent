import { tool } from "@openai/agents";

import { normalizeUserId } from "@/lib/auth";
import type { UploadedAttachment } from "@/lib/chat/message-converters";
import {
  type EngineUpload,
  runEngineAiDetectionAnalyze,
  runEngineGrade,
  runEngineSimilarityAnalyze,
} from "@/lib/engine/client";
import { studentsFromResult, type StudentRow } from "@/lib/grading";
import {
  getGradingSession,
  getLatestRunId,
  getStoredFileByKey,
  saveGradingSession,
  saveLatestRunId,
  userStorageKey,
} from "@/lib/storage";

export type GradingContext = {
  attachments?: UploadedAttachment[];
  userId?: string;
};

type ToolParameter = {
  description?: string;
  type: "string";
};

type ToolSchema = {
  additionalProperties: true;
  properties: Record<string, ToolParameter>;
  required: string[];
  type: "object";
};

type FollowupPayloadField = "similarity" | "aiDetection";
type FollowupToolName = "check_similarity" | "check_ai_detection";

const gradeSubmissionsSchema: ToolSchema = {
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

const noArgsSchema: ToolSchema = {
  additionalProperties: true,
  properties: {},
  required: [],
  type: "object",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickStringArg(args: unknown, ...keys: string[]) {
  if (!isRecord(args)) {
    return undefined;
  }

  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function latestAttachment(attachments: UploadedAttachment[] | undefined) {
  return attachments?.at(-1);
}

async function r2AttachmentToUpload(
  attachment: UploadedAttachment,
  userId: string,
): Promise<EngineUpload> {
  const objectKey = attachment.url.startsWith("r2://")
    ? attachment.url.slice("r2://".length).trim()
    : "";

  if (!objectKey) {
    throw new Error("Uploaded attachment reference is invalid.");
  }

  const expectedUserKey = userStorageKey(userId);
  if (!objectKey.includes(`/${expectedUserKey}/`)) {
    throw new Error("Uploaded attachment does not belong to this user.");
  }

  const object = await getStoredFileByKey(objectKey);
  if (!object) {
    throw new Error("Uploaded attachment was not found. Please re-upload it.");
  }

  return {
    bytes: object.bytes,
    filename: attachment.filename ?? "submissions.zip",
    mediaType: object.contentType ?? attachment.mediaType ?? "application/zip",
  };
}

/** Keep streamed tool output small; the full run is loaded from R2 by run id. */
function compactStudent(row: StudentRow) {
  return {
    bannedCount: row.bannedCount,
    compileOk: row.compileOk,
    grade: row.grade,
    status: row.status,
    studentId: row.studentId,
  };
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

    const attachment = latestAttachment(runContext?.context.attachments);
    if (!attachment) {
      return {
        message:
          "No zip file was attached. Ask the user to attach a submissions zip file and include the assignment name.",
      };
    }

    const userId = normalizeUserId(runContext?.context.userId);
    const upload = await r2AttachmentToUpload(attachment, userId);
    const result = await runEngineGrade(assignmentName, upload);
    const runId = pickStringArg(result, "run_id", "runId");
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
      result,
      updatedAt: now,
      uploads: [],
    });
    await saveLatestRunId(userId, runId);

    const students = studentsFromResult(result);
    return {
      assignmentName,
      runId,
      studentCount: students.length,
      students: students.map(compactStudent),
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
  analyze: (runId: string) => Promise<Record<string, unknown>>;
  description: string;
  name: FollowupToolName;
  payloadField: FollowupPayloadField;
  payloadKey: string;
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

  const result = await config.analyze(runId);
  const now = new Date().toISOString();
  await saveGradingSession(userId, {
    ...session,
    result: {
      ...session.result,
      ...result,
    },
    updatedAt: now,
  });

  return {
    assignmentName: session.assignmentName,
    runId,
    summary: summarizeFollowupPayload(
      config.payloadField,
      result[config.payloadKey],
    ),
  };
}

function createFollowupTool(config: FollowupToolConfig) {
  return tool<typeof noArgsSchema, GradingContext>({
    description: config.description,
    name: config.name,
    parameters: noArgsSchema,
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
  analyze: (runId) =>
    runEngineSimilarityAnalyze(runId, { includeSpans: true, minScore: 10 }),
  description:
    "Check pairwise similarity across submissions in the latest graded run to spot potential copies.",
  name: "check_similarity",
  payloadField: "similarity",
  payloadKey: "similarity",
});

export const checkAiDetection = createFollowupTool({
  analyze: (runId) => runEngineAiDetectionAnalyze(runId, { includeSpans: true }),
  description:
    "Run an AI-detection pass on submissions in the latest graded run to flag likely AI-generated code.",
  name: "check_ai_detection",
  payloadField: "aiDetection",
  payloadKey: "ai_detection",
});
