import { assistant, system, user, type AgentInputItem } from "@openai/agents";
import type { FileUIPart, UIMessage } from "ai";

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

export function extractUiMessageText(message: UiMessageWithLegacyContent) {
  const text = message.parts?.filter(isTextPart).map((part) => part.text).join("") ?? "";

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

export function extractAttachments(messages: UIMessage[]): UploadedAttachment[] {
  return messages.flatMap((message) =>
    (message.parts ?? []).filter(isFilePart).map((part) => ({
      filename: part.filename,
      mediaType: part.mediaType,
      url: part.url,
    }))
  );
}

export function toAgentInput(messages: UiMessageWithLegacyContent[]): AgentInputItem[] {
  const input: AgentInputItem[] = [];

  for (const message of messages) {
    const text = `${extractUiMessageText(message)}${describeFiles(message)}`.trim();
    if (!text) {
      continue;
    }

    switch (message.role) {
      case "system":
        input.push(system(text));
        break;
      case "assistant":
        input.push(assistant(text));
        break;
      default:
        input.push(user(text));
        break;
    }
  }

  return input;
}
