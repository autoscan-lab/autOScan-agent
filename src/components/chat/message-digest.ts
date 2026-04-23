import type { UIMessage } from "ai";

export function messageDigest(messages: UIMessage[]) {
  return messages
    .map((message) => {
      const partDigest = message.parts
        .map((part) => {
          if (part.type === "text") {
            return `text:${part.text}`;
          }
          if (part.type === "file") {
            return `file:${part.filename ?? "unknown"}:${part.url}`;
          }
          if ("state" in part && typeof part.state === "string") {
            const output =
              "output" in part && part.output
                ? JSON.stringify(part.output)
                : "";
            const toolCallId =
              "toolCallId" in part && typeof part.toolCallId === "string"
                ? part.toolCallId
                : "";
            return `${part.type}:${toolCallId}:${part.state}:${output}`;
          }
          return part.type;
        })
        .join(",");
      return `${message.id}:${message.role}:${partDigest}`;
    })
    .join("|");
}
