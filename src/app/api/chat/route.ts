import { run } from "@openai/agents";
import { createAiSdkUiMessageStreamResponse } from "@openai/agents-extensions/ai-sdk-ui";
import type { UIMessage } from "ai";

import { gradingAgent } from "@/agents/grading";
import { auth } from "@/auth";
import { extractAttachments, toAgentInput } from "@/lib/message-converters";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const messages = Array.isArray(body?.messages)
    ? (body.messages as UIMessage[])
    : [];
  const chatId =
    typeof body?.id === "string" && body.id.trim()
      ? body.id
      : undefined;

  const input = toAgentInput(messages);
  if (input.length === 0) {
    return new Response("Missing messages.", { status: 400 });
  }

  try {
    const stream = await run(gradingAgent, input, {
      context: {
        attachments: extractAttachments(messages),
        userId: session.user.email ?? session.user.name ?? "unknown-user",
      },
      conversationId: chatId,
      maxTurns: 4,
      stream: true,
    });

    return createAiSdkUiMessageStreamResponse(stream);
  } catch (error) {
    const err = error as {
      cause?: { data?: unknown; responseBody?: string };
      responseBody?: string;
    };
    const cause = err?.cause;
    let providerDetail: unknown;
    const raw =
      typeof cause?.responseBody === "string"
        ? cause.responseBody
        : typeof err?.responseBody === "string"
          ? err.responseBody
          : undefined;
    if (raw) {
      try {
        providerDetail = JSON.parse(raw) as unknown;
      } catch {
        providerDetail = raw;
      }
    }
    console.error("[/api/chat] agent run failed", {
      cause,
      error,
      providerDetail,
    });
    return new Response("Chat request failed. Please try again.", {
      status: 500,
    });
  }
}
