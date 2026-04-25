"use client";

import { useChat } from "@ai-sdk/react";
import type { FileUIPart, UIMessage } from "ai";
import {
  LogOutIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  Trash2Icon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ChatMessages } from "@/components/chat/messages/ChatMessages";
import { InspectorPanel } from "@/components/chat/inspector/InspectorPanel";
import { ZipPromptInput } from "@/components/chat/prompt/ZipPromptInput";
import { initialsOf } from "@/components/chat/support/display";
import { useGradingPanel } from "@/hooks/useGradingPanel";
import { usePersistentChat } from "@/hooks/usePersistentChat";
import type {
  ChatProps,
  UploadResponse,
  ZipPromptMessage,
} from "@/components/chat/support/types";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/chat/ai-elements/conversation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const PixelBlastBackground = dynamic(() => import("@/components/chat/PixelBlast"), {
  ssr: false,
});

const chatWatchdogMs = 120_000;
const maxZipUploadBytes = 12 * 1024 * 1024;
const zipAcceptAttr = ".zip,application/zip,application/x-zip-compressed";
const assignmentPattern = /\bS\d+\b/i;

function latestRunId(messages: UIMessage[]) {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message.role !== "assistant") {
      continue;
    }

    for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = message.parts[partIndex];
      if (!("output" in part) || typeof part.output !== "object" || !part.output) {
        continue;
      }
      const output = part.output as Record<string, unknown>;
      const runId = output.runId;
      if (typeof runId === "string" && runId.trim()) {
        return runId.trim();
      }
    }
  }

  return undefined;
}

function ackTextForToolReadyTurn(
  text: string,
  files: FileUIPart[],
  messages: UIMessage[],
) {
  const normalized = text.toLowerCase();
  const hasAssignment = assignmentPattern.test(text);

  if (files.length > 0 && hasAssignment) {
    return "Got it, I have your zip and assignment. I'll run the grader now.";
  }

  const hasRunId = Boolean(latestRunId(messages));
  if (hasRunId && normalized.includes("similar")) {
    return "Got it, I'll run a similarity check now.";
  }
  if (
    hasRunId &&
    (normalized.includes("ai detect") ||
      normalized.includes("ai detection") ||
      normalized.includes("ai-generated"))
  ) {
    return "Got it, I'll run AI detection now.";
  }

  return undefined;
}

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
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [pendingAck, setPendingAck] = useState<string | null>(null);

  const { error, id, messages, sendMessage, setMessages, status, stop } =
    useChat({
      experimental_throttle: 80,
      id: initialChatId,
      messages: initialMessages,
    });

  const isModelBusy = status === "submitted" || status === "streaming";
  const displayName = userName || userEmail || "User";
  const messageList = useMemo(() => messages ?? [], [messages]);

  const { resetPersistenceDigest } = usePersistentChat({
    chatId: id,
    initialMessages,
    messages: messageList,
    status,
  });

  const {
    aiDetectionReport,
    panelData,
    panelError,
    panelLoading,
    panelOpen,
    panelView,
    resetPanel,
    selectedStudentId,
    setPanelOpen,
    setSelectedStudentId,
    setPanelView,
    similarityReport,
  } = useGradingPanel(messageList);

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
    setPendingAck(null);
    resetPanel();
    resetPersistenceDigest();
  }, [resetPanel, resetPersistenceDigest, setMessages]);

  const handlePromptSubmit = useCallback(
    async (message: ZipPromptMessage) => {
      setRuntimeError(null);
      setAttachmentError(null);

      const trimmedText = message.text.trim();
      if (!trimmedText && message.files.length === 0) {
        return;
      }

      try {
        const uploaded = message.files;
        const ackText = ackTextForToolReadyTurn(trimmedText, uploaded, messageList);

        if (uploaded.length > 0 && trimmedText) {
          void sendMessage({ files: uploaded, text: trimmedText });
        } else if (uploaded.length > 0) {
          void sendMessage({ files: uploaded });
        } else {
          void sendMessage({ text: trimmedText });
        }

        setPendingAck(ackText ?? null);
      } catch (submitError) {
        setAttachmentError(
          submitError instanceof Error
            ? submitError.message
            : "Could not send your request.",
        );
        throw submitError;
      }
    },
    [messageList, sendMessage],
  );

  useEffect(() => {
    if (
      pendingAck &&
      messageList[messageList.length - 1]?.role === "assistant"
    ) {
      setPendingAck(null);
    }
  }, [messageList, pendingAck]);

  const handleAssistantElapsedSettled = useCallback(
    (messageId: string, elapsedMs: number) => {
      const roundedElapsedMs = Math.max(0, Math.round(elapsedMs));

      setMessages((current) =>
        current.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          const metadata = metadataRecord(message);
          if (metadata.elapsedMs === roundedElapsedMs) {
            return message;
          }

          return {
            ...message,
            metadata: {
              ...metadata,
              elapsedMs: roundedElapsedMs,
            },
          };
        }),
      );
    },
    [setMessages],
  );

  useEffect(() => {
    if (!isModelBusy) {
      return;
    }
    const timeout = window.setTimeout(() => {
      stop();
      setRuntimeError(
        "The assistant took too long and was stopped. Please retry your request.",
      );
    }, chatWatchdogMs);
    return () => window.clearTimeout(timeout);
  }, [isModelBusy, stop]);

  const inspectorNode = (
    <InspectorPanel
      aiDetectionReport={aiDetectionReport}
      data={panelData}
      error={panelError}
      loading={panelLoading}
      onViewChange={setPanelView}
      selectedStudentId={selectedStudentId}
      similarityReport={similarityReport}
      view={panelView}
    />
  );

  return (
    <div className="relative flex h-screen flex-col text-[var(--foreground)]">
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

      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-3 py-1.5 md:px-4">
        <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account menu"
              className="pointer-events-auto inline-flex size-7 items-center justify-center overflow-hidden rounded-full border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] font-mono text-[10px] font-[510] text-[var(--chat-text-secondary)] shadow-[var(--shadow-dialog)] backdrop-blur-md transition-colors hover:border-[var(--linear-border)] hover:bg-[var(--linear-ghost-hover)] hover:text-[var(--foreground)]"
            >
              {userImage ? (
                <Image
                  alt=""
                  className="size-full object-cover"
                  height={28}
                  priority
                  referrerPolicy="no-referrer"
                  src={userImage}
                  width={28}
                />
              ) : (
                initialsOf(displayName)
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-60">
              <div className="flex flex-col gap-0.5 px-2 pt-2 pb-1.5">
                <span className="text-[13px] font-[510] text-[var(--foreground)]">
                  {userName || "Signed in"}
                </span>
                {userEmail ? (
                  <span className="truncate font-mono text-[11px] text-[var(--chat-text-muted)]">
                    {userEmail}
                  </span>
                ) : null}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={
                  isModelBusy || isClearingHistory || messageList.length === 0
                }
                onClick={async () => {
                  setIsClearingHistory(true);
                  try {
                    await clearHistory();
                  } catch (clearError) {
                    setRuntimeError(
                      clearError instanceof Error
                        ? clearError.message
                        : "Could not clear chat history.",
                    );
                  } finally {
                    setIsClearingHistory(false);
                  }
                }}
              >
                <Trash2Icon />
                {isClearingHistory ? "Clearing..." : "Clear chat"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void signOut({ redirectTo: "/sign-in" })}
                variant="destructive"
              >
                <LogOutIcon />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div>
            {!panelOpen ? (
              <button
                aria-expanded={panelOpen}
                aria-label="Open inspector"
                className="pointer-events-auto inline-flex size-7 items-center justify-center rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] text-[var(--chat-text-secondary)] shadow-[var(--shadow-dialog)] backdrop-blur-md transition-colors hover:border-[var(--linear-border)] hover:bg-[var(--linear-ghost-hover)] hover:text-[var(--foreground)] md:hidden"
                onClick={() => setPanelOpen(true)}
                type="button"
              >
                <PanelRightOpenIcon className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main
        className="relative z-10 flex min-h-0 flex-1 overflow-hidden"
        style={
          {
            "--chat-column-w": "54rem",
            "--inspector-w": "min(36rem, 46vw)",
          } as React.CSSProperties
        }
      >
        <section
          className={cn(
            "relative flex min-w-0 flex-1 flex-col transition-[margin-right] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            panelOpen ? "md:mr-[var(--inspector-w)]" : "md:mr-0",
          )}
        >
          <Conversation className="relative z-10 flex-1">
            <ConversationContent
              className="mx-auto w-full max-w-[var(--chat-column-w)] gap-6 px-3 pb-44 pt-6 md:px-6"
            >
              <ChatMessages
                isModelBusy={isModelBusy}
                messages={messageList}
                onAssistantElapsedSettled={handleAssistantElapsedSettled}
                pendingAck={pendingAck}
                onSelectStudent={(studentId) => {
                  setSelectedStudentId(studentId);
                  setPanelView("source");
                  setPanelOpen(true);
                }}
                selectedStudentId={selectedStudentId}
                userName={userName}
              />

              {runtimeError ? (
                <div className="rounded-md border border-[var(--linear-accent)]/35 bg-[var(--linear-accent)]/10 px-3 py-2 text-sm text-[var(--linear-accent-hover)]">
                  {runtimeError}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-md border border-[var(--linear-danger)]/35 bg-[var(--linear-danger)]/10 px-3 py-2 text-sm text-[var(--linear-danger)]">
                  {error.message}
                </div>
              ) : null}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10"
          >
            <div className="px-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:pb-5">
              <div className="pointer-events-auto mx-auto w-full max-w-[var(--chat-column-w)]">
                {attachmentError ? (
                  <p className="mb-2 text-xs text-[var(--linear-danger)]">
                    {attachmentError}
                  </p>
                ) : null}

                <ZipPromptInput
                  accept={zipAcceptAttr}
                  busy={isModelBusy}
                  maxFileSize={maxZipUploadBytes}
                  onError={setAttachmentError}
                  onStop={stop}
                  onSubmit={handlePromptSubmit}
                  onUploadFile={uploadAttachment}
                />
              </div>
            </div>
          </div>
        </section>

        <aside
          className="pointer-events-none fixed inset-y-0 right-0 z-50 hidden w-[var(--inspector-w)] max-w-[680px] p-2 pl-0 md:block"
          role="complementary"
        >
          <button
            aria-expanded={panelOpen}
            aria-label={panelOpen ? "Close inspector" : "Open inspector"}
            className="pointer-events-auto absolute right-3 top-3 z-20 inline-flex size-7 items-center justify-center rounded-md border border-[var(--linear-border)] bg-[#030304]/90 text-[var(--chat-text-secondary)] shadow-[var(--shadow-dialog)] backdrop-blur-md transition-colors hover:bg-[#08080a] hover:text-[var(--foreground)]"
            onClick={() => setPanelOpen((value) => !value)}
            type="button"
          >
            {panelOpen ? (
              <PanelRightCloseIcon className="size-3.5" />
            ) : (
              <PanelRightOpenIcon className="size-3.5" />
            )}
          </button>

          <div
            aria-hidden={!panelOpen}
            className={cn(
              "pointer-events-auto flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--linear-border)] bg-[var(--chat-panel)] shadow-[var(--shadow-dialog),var(--shadow-ring)] transition-transform duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              panelOpen
                ? "translate-x-0"
                : "translate-x-[calc(100%+0.75rem)]",
            )}
          >
            {inspectorNode}
          </div>
        </aside>
      </main>

      <div
        aria-hidden={!panelOpen}
        className={cn(
          "fixed inset-0 z-40 md:hidden",
          panelOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <button
          aria-label="Close inspector"
          className={cn(
            "absolute inset-0 bg-[var(--chat-overlay)] transition-opacity duration-200 ease-out",
            panelOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setPanelOpen(false)}
          tabIndex={panelOpen ? 0 : -1}
          type="button"
        />
        <div
          className={cn(
            "absolute inset-y-3 right-3 flex w-[min(94vw,28rem)] overflow-hidden rounded-xl border border-[var(--linear-border)] bg-[var(--chat-panel)] shadow-[var(--shadow-dialog),var(--shadow-ring)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            panelOpen
              ? "translate-x-0"
              : "translate-x-[calc(100%+1rem)]",
          )}
        >
          {inspectorNode}
        </div>
      </div>
    </div>
  );
}
