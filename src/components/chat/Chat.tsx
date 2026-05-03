"use client";

import { useChat } from "@ai-sdk/react";
import type { FileUIPart, UIMessage } from "ai";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AccountMenu } from "@/components/chat/account/AccountMenu";
import { AgentBar } from "@/components/chat/agent/AgentBar";
import { ResultsPane } from "@/components/chat/results/ResultsPane";
import type { LayoutState } from "@/components/chat/results/ResultsPane";
import { AIDetectionDetail } from "@/components/chat/results/drawer/ai-detection/AIDetectionDetail";
import { SimilarityDetail } from "@/components/chat/results/drawer/similarity/SimilarityDetail";
import { StudentDetail } from "@/components/chat/results/drawer/student/StudentDetail";
import {
  selectedAiDetectionSubmission,
  selectedSimilarityPair,
} from "@/components/chat/shared/tool-reports";
import { useGradingPanel } from "@/hooks/useGradingPanel";
import { usePersistentChat } from "@/hooks/usePersistentChat";
import type {
  ChatProps,
  DetailSelection,
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
    similarityReport,
  } = useGradingPanel(messageList);

  const layoutState: LayoutState = panelData || panelLoading || hasGradingRun
    ? "results"
    : isModelBusy
      ? "active"
      : "empty";
  const students = useMemo(() => panelData?.students ?? [], [panelData?.students]);
  const [detailSelection, setDetailSelection] = useState<DetailSelection>(null);
  const selectedStudentId = detailSelection?.kind === "student"
    ? detailSelection.id
    : null;
  const selectedSimilarityPairId = detailSelection?.kind === "similarity"
    ? detailSelection.id
    : null;
  const selectedAiDetectionId = detailSelection?.kind === "aiDetection"
    ? detailSelection.id
    : null;
  const selectedStudent = useMemo(
    () => students.find((student) => student.studentId === selectedStudentId) ?? null,
    [selectedStudentId, students],
  );
  const selectedSimilarity = useMemo(
    () => selectedSimilarityPair(similarityReport, selectedSimilarityPairId),
    [selectedSimilarityPairId, similarityReport],
  );
  const selectedAiDetection = useMemo(
    () => selectedAiDetectionSubmission(aiDetectionReport, selectedAiDetectionId),
    [aiDetectionReport, selectedAiDetectionId],
  );
  const selectedAiDetectionStudent = useMemo(
    () => students.find((student) => student.studentId === selectedAiDetectionId) ?? null,
    [selectedAiDetectionId, students],
  );

  const detailIsVisible = Boolean(
    selectedStudent || selectedSimilarity || selectedAiDetection,
  );
  const [detailOpenForPill, setDetailOpenForPill] = useState(false);
  const openDetail = useCallback((selection: Exclude<DetailSelection, null>) => {
    setDetailSelection(selection);
    setDetailOpenForPill(true);
  }, []);
  const closeDetail = useCallback(() => {
    setDetailSelection(null);
  }, []);
  const handleDetailCloseStart = useCallback(() => {
    setDetailOpenForPill(false);
  }, []);

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
    setDetailSelection(null);
    setDetailOpenForPill(false);
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
          detailSelection={detailSelection}
          layoutState={layoutState}
          onSelectDetail={openDetail}
          panelData={panelData}
          panelError={panelError}
          panelLoading={panelLoading}
          similarityReport={similarityReport}
        />
        <AgentBar
          attachmentError={attachmentError}
          detailOpen={detailOpenForPill && detailIsVisible}
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
        {selectedStudent ? (
          <StudentDetail
            onClose={closeDetail}
            onCloseStart={handleDetailCloseStart}
            onNavigate={(id) => openDetail({ id, kind: "student" })}
            student={selectedStudent}
            students={students}
          />
        ) : selectedSimilarity ? (
          <SimilarityDetail
            onClose={closeDetail}
            onCloseStart={handleDetailCloseStart}
            pair={selectedSimilarity}
            students={students}
          />
        ) : selectedAiDetection ? (
          <AIDetectionDetail
            onClose={closeDetail}
            onCloseStart={handleDetailCloseStart}
            student={selectedAiDetectionStudent}
            submission={selectedAiDetection}
          />
        ) : null}
      </main>
    </div>
  );
}
