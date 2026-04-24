import type { UIMessage } from "ai";

import { auth } from "@/auth";
import {
  clearChatState,
  getChatState,
  saveChatState,
} from "@/lib/chat/chat-state";
import { resolveSessionUserId } from "@/lib/auth";
import { deleteUserStoredRuns } from "@/lib/storage";

export const runtime = "nodejs";

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

  return Response.json(await getChatState(resolveSessionUserId(session)));
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

  const userId = resolveSessionUserId(session);
  const existingState = await getChatState(userId);
  const chatId =
    typeof body?.chatId === "string" && body.chatId.trim()
      ? body.chatId
      : existingState.chatId;

  return Response.json(
    await saveChatState(userId, {
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

  const userId = resolveSessionUserId(session);
  const state = await clearChatState(userId);
  await deleteUserStoredRuns(userId).catch((error: unknown) => {
    console.error("[/api/chat/state] storage cleanup failed", error);
  });

  return Response.json(state);
}
