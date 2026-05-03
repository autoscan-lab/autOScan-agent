"use client";

import { useChat } from "@ai-sdk/react";
import type { FileUIPart, UIMessage } from "ai";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AccountMenu } from "@/components/chat/account/AccountMenu";
import { AgentBar } from "@/components/chat/agent/AgentBar";
import { ResultsPane } from "@/components/chat/results/ResultsPane";
import type { LayoutState } from "@/components/chat/results/ResultsPane";
import { useGradingPanel } from "@/hooks/useGradingPanel";
import { usePersistentChat } from "@/hooks/usePersistentChat";
import type {
  ChatProps,
  UploadResponse,
  ZipPromptMessage,
} from "@/components/chat/shared/types";

const PixelBlastBackground = dynamic(() => import("@/components/chat/background/PixelBlast"), {
  ssr: false,
});

const chatWatchdogMs = 120_000;

function metadataRecord(message: UIMessage) {
  return typeof message.metadata === "object" &&
    message.metadata !== null &&
    !Array.isArray(message.metadata)
    ? (message.metadata as Record<string, unknown>)
    : {};
}

export function Chat({
  initialChatId,
  initialMessages,
  userEmail,
  userImage,
  userName,
}: ChatProps) {
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const { error, id, messages, sendMessage, setMessages, status, stop } =
    useChat({
      experimental_throttle: 80,
      id: initialChatId,
      messages: initialMessages,
    });

  const isModelBusy = status === "submitted" || status === "streaming";
  const messageList = useMemo(() => messages ?? [], [messages]);

  const { resetPersistenceDigest } = usePersistentChat({
    chatId: id,
    initialMessages,
    messages: messageList,
    status,
  });

  const {
    aiDetectionReport,
    hasGradingRun,
    panelData,
    panelError,
    panelLoading,
    resetPanel,
    selectedStudentId,
    setSelectedStudentId,
    similarityReport,
  } = useGradingPanel(messageList);

  const layoutState: LayoutState = panelData || panelLoading || hasGradingRun
    ? "results"
    : isModelBusy
      ? "active"
      : "empty";

  const uploadAttachment = useCallback(
    async (file: File): Promise<FileUIPart> => {
      const formData = new FormData();
      formData.set("file", file, file.name);

      const response = await fetch("/api/chat/uploads", {
        body: formData,
        method: "POST",
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || "Attachment upload failed.");
      }

      const payload = (await response.json()) as UploadResponse;
      return {
        filename: payload.filename ?? file.name,
        mediaType: payload.mediaType ?? file.type ?? "application/zip",
        type: "file",
        url: payload.url,
      };
    },
    [],
  );

  const clearHistory = useCallback(async () => {
    const response = await fetch("/api/chat/state", { method: "DELETE" });
    if (!response.ok) {
      throw new Error("Could not clear chat history.");
    }
    setMessages([]);
    setRuntimeError(null);
    setAttachmentError(null);
    resetPanel();
    resetPersistenceDigest();
  }, [resetPanel, resetPersistenceDigest, setMessages]);

  const handlePromptSubmit = useCallback(
    async (message: ZipPromptMessage) => {
      setRuntimeError(null);
      setAttachmentError(null);

      const trimmedText = message.text.trim();
      if (!trimmedText && message.files.length === 0) return;

      try {
        const uploaded = message.files;
        if (uploaded.length > 0 && trimmedText) {
          void sendMessage({ files: uploaded, text: trimmedText });
        } else if (uploaded.length > 0) {
          void sendMessage({ files: uploaded });
        } else {
          void sendMessage({ text: trimmedText });
        }
      } catch (submitError) {
        setAttachmentError(
          submitError instanceof Error
            ? submitError.message
            : "Could not send your request.",
        );
        throw submitError;
      }
    },
    [sendMessage],
  );

  const handleAssistantElapsedSettled = useCallback(
    (messageId: string, elapsedMs: number) => {
      const roundedElapsedMs = Math.max(0, Math.round(elapsedMs));
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== messageId) return message;
          const metadata = metadataRecord(message);
          if (metadata.elapsedMs === roundedElapsedMs) return message;
          return { ...message, metadata: { ...metadata, elapsedMs: roundedElapsedMs } };
        }),
      );
    },
    [setMessages],
  );

  useEffect(() => {
    if (!isModelBusy) return;
    const timeout = window.setTimeout(() => {
      stop();
      setRuntimeError(
        "The assistant took too long and was stopped. Please retry your request.",
      );
    }, chatWatchdogMs);
    return () => window.clearTimeout(timeout);
  }, [isModelBusy, stop]);

  return (
    <div className="relative flex h-screen flex-col text-[var(--foreground)]">
      {/* Background layers */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[var(--chat-bg)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] opacity-40 mix-blend-screen"
      >
        <PixelBlastBackground
          autoPauseOffscreen
          color="#1c1c1c"
          edgeFade={0.25}
          enableRipples
          patternDensity={1}
          patternScale={2}
          pixelSize={3}
          pixelSizeJitter={0}
          speed={0.4}
          transparent
          variant="square"
        />
      </div>

      <AccountMenu
        isModelBusy={isModelBusy}
        messageCount={messageList.length}
        onClearHistory={clearHistory}
        onError={setRuntimeError}
        userEmail={userEmail}
        userImage={userImage}
        userName={userName}
      />

      {/* Main layout: results pane (top) + agent bar (bottom) */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        <ResultsPane
          aiDetectionReport={aiDetectionReport}
          layoutState={layoutState}
          panelData={panelData}
          panelError={panelError}
          panelLoading={panelLoading}
          selectedStudentId={selectedStudentId}
          setSelectedStudentId={setSelectedStudentId}
          similarityReport={similarityReport}
        />
        <AgentBar
          attachmentError={attachmentError}
          error={error}
          isModelBusy={isModelBusy}
          layoutState={layoutState}
          messages={messageList}
          onElapsedSettled={handleAssistantElapsedSettled}
          onError={setAttachmentError}
          onStop={stop}
          onSubmit={handlePromptSubmit}
          onUploadFile={uploadAttachment}
          panelData={panelData}
          runtimeError={runtimeError}
          userName={userName}
        />
      </main>
    </div>
  );
}
