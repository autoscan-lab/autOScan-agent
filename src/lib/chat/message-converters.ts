import {
  assistant,
  user,
  type AgentInputItem,
  type FunctionCallItem,
  type FunctionCallResultItem,
} from "@openai/agents";
import type { DynamicToolUIPart, FileUIPart, UIMessage } from "ai";

export type UploadedAttachment = {
  filename?: string;
  mediaType: string;
  url: string;
};

type TextPart = {
  type: "text";
  text: string;
};

type UiMessageWithLegacyContent = UIMessage & {
  content?: string;
};

function isTextPart(part: UIMessage["parts"][number]): part is TextPart {
  return part.type === "text";
}

function isFilePart(part: UIMessage["parts"][number]): part is FileUIPart {
  return part.type === "file";
}

function isDynamicToolPart(
  part: UIMessage["parts"][number],
): part is DynamicToolUIPart {
  return part.type === "dynamic-tool";
}

export function extractUiMessageText(message: UiMessageWithLegacyContent) {
  const text =
    message.parts
      ?.filter(isTextPart)
      .map((part) => part.text)
      .join("") ?? "";

  if (text) {
    return text;
  }

  return typeof message.content === "string" ? message.content : "";
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

export function toAgentInput(
  messages: UiMessageWithLegacyContent[],
): AgentInputItem[] {
  const input: AgentInputItem[] = [];

  for (const message of messages) {
    // Never trust client-supplied system messages.
    if (message.role === "system") {
      continue;
    }

    if (message.role === "assistant") {
      const toolParts = message.parts?.filter(isDynamicToolPart) ?? [];

      for (const part of toolParts) {
        if (part.state !== "output-available") continue;

        input.push({
          type: "function_call",
          callId: part.toolCallId,
          name: part.toolName,
          arguments: JSON.stringify(part.input ?? {}),
        } as FunctionCallItem);

        input.push({
          type: "function_call_result",
          callId: part.toolCallId,
          name: part.toolName,
          status: "completed",
          output: JSON.stringify(part.output ?? null),
        } as FunctionCallResultItem);
      }

      const text =
        `${extractUiMessageText(message)}${describeFiles(message)}`.trim();
      if (text) {
        input.push(assistant(text));
      }
    } else {
      const text =
        `${extractUiMessageText(message)}${describeFiles(message)}`.trim();
      if (!text) continue;
      input.push(user(text));
    }
  }

  return input;
}
