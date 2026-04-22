import type { UIMessage } from "ai";

import { auth } from "@/auth";
import { clearChatState, getChatState, saveChatState } from "@/lib/chat-state";
import { clearLatestGradingSession } from "@/lib/r2-storage";

export const runtime = "nodejs";

type AuthSessionLike = {
  user?: {
    email?: string | null;
    name?: string | null;
  };
} | null;

function sessionUserId(session: AuthSessionLike) {
  return session?.user?.email ?? session?.user?.name ?? "unknown-user";
}

function isUiMessageArray(value: unknown): value is UIMessage[] {
  return (
    Array.isArray(value) &&
    value.every(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        "role" in message &&
        "parts" in message &&
        Array.isArray((message as { parts?: unknown }).parts),
    )
  );
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  return Response.json(await getChatState(sessionUserId(session)));
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!isUiMessageArray(body?.messages)) {
    return new Response("Invalid messages payload.", { status: 400 });
  }

  const existingState = await getChatState(sessionUserId(session));
  const chatId =
    typeof body?.chatId === "string" && body.chatId.trim()
      ? body.chatId
      : existingState.chatId;

  return Response.json(
    await saveChatState(sessionUserId(session), {
      chatId,
      messages: body.messages,
    }),
  );
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = sessionUserId(session);
  const [cleared] = await Promise.all([
    clearChatState(userId),
    clearLatestGradingSession(userId).catch(() => undefined),
  ]);
  return Response.json(cleared);
}
