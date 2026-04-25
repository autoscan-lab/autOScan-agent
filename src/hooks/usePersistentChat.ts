"use client";

import type { ChatStatus, UIMessage } from "ai";
import { useCallback, useEffect, useRef } from "react";

type UsePersistentChatInput = {
  chatId: string;
  initialMessages?: UIMessage[];
  messages: UIMessage[];
  status: ChatStatus;
};

const persistDebounceMs = 250;

export function usePersistentChat({
  chatId,
  initialMessages,
  messages,
  status,
}: UsePersistentChatInput) {
  const lastPersistedMessagesRef = useRef(initialMessages ?? []);

  const persistChatState = useCallback(
    async (nextMessages: UIMessage[]) => {
      if (nextMessages.length === 0) {
        return;
      }
      if (nextMessages === lastPersistedMessagesRef.current) {
        return;
      }

      const response = await fetch("/api/chat/state", {
        body: JSON.stringify({
          chatId,
          messages: nextMessages,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error("Could not persist chat state.");
      }

      lastPersistedMessagesRef.current = nextMessages;
    },
    [chatId],
  );

  useEffect(() => {
    if (status !== "ready" && status !== "error") {
      return;
    }
    if (messages.length === 0) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void persistChatState(messages).catch(() => {
        // Keep the chat interactive even if persistence fails transiently.
      });
    }, persistDebounceMs);

    return () => window.clearTimeout(timeout);
  }, [messages, persistChatState, status]);

  return {
    resetPersistenceDigest: () => {
      lastPersistedMessagesRef.current = [];
    },
  };
}
