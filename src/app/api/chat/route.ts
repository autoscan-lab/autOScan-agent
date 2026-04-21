import { run } from "@openai/agents";
import { createAiSdkUiMessageStreamResponse } from "@openai/agents-extensions/ai-sdk-ui";
import type { UIMessage } from "ai";

import { gradingAgent } from "@/agents/grading";
import { auth } from "@/auth";
import { extractAttachments, toAgentInput } from "@/lib/message-converters";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const messages = Array.isArray(body?.messages)
    ? (body.messages as UIMessage[])
    : [];

  const input = toAgentInput(messages);
  if (input.length === 0) {
    return new Response("Missing messages.", { status: 400 });
  }

  const stream = await run(gradingAgent, input, {
    context: {
      attachments: extractAttachments(messages),
      userId: session.user.email ?? session.user.name ?? "unknown-user",
    },
    stream: true,
  });

  return createAiSdkUiMessageStreamResponse(stream);
}
