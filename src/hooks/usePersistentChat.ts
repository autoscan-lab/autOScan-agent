"use client";

import type { ChatStatus, UIMessage } from "ai";
import { useCallback, useEffect, useRef } from "react";

import { messageDigest } from "@/components/chat/messages/message-digest";

type UsePersistentChatInput = {
  chatId: string;
  initialMessages?: UIMessage[];
  messages: UIMessage[];
  status: ChatStatus;
};

export function usePersistentChat({
  chatId,
  initialMessages,
  messages,
  status,
}: UsePersistentChatInput) {
  const lastPersistedDigest = useRef(messageDigest(initialMessages ?? []));

  const persistChatState = useCallback(
    async (nextMessages: UIMessage[]) => {
      const digest = messageDigest(nextMessages);
      if (!digest || digest === lastPersistedDigest.current) {
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

      lastPersistedDigest.current = digest;
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
    void persistChatState(messages).catch(() => {
      // Keep the chat interactive even if persistence fails transiently.
    });
  }, [messages, persistChatState, status]);

  return {
    resetPersistenceDigest: () => {
      lastPersistedDigest.current = messageDigest([]);
    },
  };
}
