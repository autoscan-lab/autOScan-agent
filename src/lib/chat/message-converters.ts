import {
  assistant,
  user,
  type AgentInputItem,
  type FunctionCallItem,
  type FunctionCallResultItem,
} from "@openai/agents";
import {
  isToolUIPart,
  type DynamicToolUIPart,
  type FileUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai";

export type UploadedAttachment = {
  filename?: string;
  mediaType: string;
  url: string;
};

type TextPart = {
  type: "text";
  text: string;
};

type ToolPart = ToolUIPart | DynamicToolUIPart;
const maxInputMessages = 24;
const maxReplayTextChars = 2_000;

function isTextPart(part: UIMessage["parts"][number]): part is TextPart {
  return part.type === "text";
}

function isFilePart(part: UIMessage["parts"][number]): part is FileUIPart {
  return part.type === "file";
}

function toolNameOf(part: ToolPart) {
  return part.type === "dynamic-tool"
    ? part.toolName
    : part.type.replace(/^tool-/, "");
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringOf(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function htmlLikeText(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("<!doctype html") || normalized.startsWith("<html");
}

function compactReplayText(value: string) {
  if (!value.trim()) {
    return "";
  }

  if (htmlLikeText(value)) {
    return "[omitted html response]";
  }

  if (value.length <= maxReplayTextChars) {
    return value;
  }

  return `${value.slice(0, maxReplayTextChars)}...[truncated]`;
}

function numberOf(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function compactSummary(output: Record<string, unknown> | undefined) {
  const summary = recordOf(output?.summary);
  if (!summary) {
    return undefined;
  }

  return {
    flaggedPairs: numberOf(summary.flaggedPairs),
    flaggedSubmissions: numberOf(summary.flaggedSubmissions),
    hasReport: typeof summary.hasReport === "boolean" ? summary.hasReport : undefined,
    pairCount: numberOf(summary.pairCount),
    submissionCount: numberOf(summary.submissionCount),
  };
}

function minimalToolOutput(part: ToolPart, toolName: string) {
  const input = recordOf(part.input);
  const output = recordOf("output" in part ? part.output : undefined);
  const runId = stringOf(output?.runId);
  const assignmentName =
    stringOf(output?.assignmentName) ?? stringOf(input?.assignment_name);

  if (toolName === "grade_submissions") {
    return {
      assignmentName: assignmentName ?? null,
      hasReport: true,
      runId: runId ?? null,
      studentCount: numberOf(output?.studentCount) ?? null,
    };
  }

  if (toolName === "check_similarity") {
    return {
      assignmentName: assignmentName ?? null,
      runId: runId ?? null,
      summary: compactSummary(output) ?? null,
    };
  }

  if (toolName === "check_ai_detection") {
    return {
      assignmentName: assignmentName ?? null,
      runId: runId ?? null,
      summary: compactSummary(output) ?? null,
    };
  }

  return {
    assignmentName: assignmentName ?? null,
    runId: runId ?? null,
  };
}

function describeFiles(message: UIMessage) {
  const files = message.parts?.filter(isFilePart) ?? [];
  if (files.length === 0) {
    return "";
  }

  const names = files
    .map((file) => file.filename ?? file.mediaType ?? "uploaded file")
    .join(", ");

  return `\n\nAttached files available to tools: ${names}.`;
}

function messageTextWithFiles(message: UIMessage) {
  const text =
    message.parts
      ?.filter(isTextPart)
      .map((part) => part.text)
      .join("") ?? "";

  return `${compactReplayText(text)}${describeFiles(message)}`.trim();
}

export function extractLatestUserAttachments(
  messages: UIMessage[],
): UploadedAttachment[] {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  return (
    latestUserMessage?.parts.filter(isFilePart).map((part) => ({
      filename: part.filename,
      mediaType: part.mediaType,
      url: part.url,
    })) ?? []
  );
}

export function toAgentInput(messages: UIMessage[]): AgentInputItem[] {
  const input: AgentInputItem[] = [];
  const replayMessages = messages.filter((message) => message.role !== "system");
  const boundedMessages = replayMessages.slice(-maxInputMessages);

  for (const message of boundedMessages) {
    if (message.role === "assistant") {
      const toolParts = message.parts?.filter(isToolUIPart) ?? [];

      for (const part of toolParts) {
        if (part.state !== "output-available") continue;
        const toolName = toolNameOf(part);

        input.push({
          type: "function_call",
          callId: part.toolCallId,
          name: toolName,
          arguments: JSON.stringify(part.input ?? {}),
        } as FunctionCallItem);

        input.push({
          type: "function_call_result",
          callId: part.toolCallId,
          name: toolName,
          status: "completed",
          output: JSON.stringify(minimalToolOutput(part, toolName)),
        } as FunctionCallResultItem);
      }

      const text = messageTextWithFiles(message);
      if (text) {
        input.push(assistant(text));
      }
    } else {
      const text = messageTextWithFiles(message);
      if (!text) continue;
      input.push(user(text));
    }
  }

  return input;
}
