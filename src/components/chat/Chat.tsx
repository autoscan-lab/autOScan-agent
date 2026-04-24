"use client";

import { useChat } from "@ai-sdk/react";
import type { FileUIPart } from "ai";
import {
  LogOutIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  Trash2Icon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ChatMessages } from "@/components/chat/ChatMessages";
import { InspectorPanel } from "@/components/chat/InspectorPanel";
import { ZipPromptInput } from "@/components/chat/ZipPromptInput";
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

const chatWatchdogMs = 180_000;
const maxZipUploadBytes = 12 * 1024 * 1024;
const zipAcceptAttr = ".zip,application/zip,application/x-zip-compressed";

export function Chat({
  initialChatId,
  initialMessages,
  userEmail,
  userName,
}: ChatProps) {
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isClearingHistory, setIsClearingHistory] = useState(false);

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
    panelData,
    panelError,
    panelLoading,
    panelOpen,
    resetPanel,
    selectedStudentId,
    setPanelOpen,
    setSelectedStudentId,
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
      data={panelData}
      error={panelError}
      loading={panelLoading}
      selectedStudentId={selectedStudentId}
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

      <header className="sticky top-0 z-20 border-b border-[var(--linear-border-subtle)] bg-[var(--chat-header-bg)] px-3 py-2.5 backdrop-blur-md md:px-5">
        <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="font-heading text-[18px] font-[590] tracking-[-0.02em] text-[var(--foreground)]">
              autOScan
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              aria-expanded={panelOpen}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[13px] font-[510] transition-colors",
                panelOpen
                  ? "border-[var(--linear-accent)]/40 bg-[var(--linear-accent)]/12 text-[var(--linear-accent-hover)]"
                  : "border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] text-[var(--chat-text-secondary)] hover:border-[var(--linear-border)] hover:bg-[var(--linear-ghost-hover)] hover:text-[var(--foreground)]",
              )}
              onClick={() => setPanelOpen((value) => !value)}
              type="button"
            >
              {panelOpen ? (
                <PanelRightCloseIcon className="size-3.5" />
              ) : (
                <PanelRightOpenIcon className="size-3.5" />
              )}
              <span className="hidden sm:inline">Inspector</span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Account menu"
                className="inline-flex size-8 items-center justify-center rounded-full border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] font-mono text-[11px] font-[510] text-[var(--chat-text-secondary)] transition-colors hover:border-[var(--linear-border)] hover:bg-[var(--linear-ghost-hover)] hover:text-[var(--foreground)]"
              >
                {initialsOf(displayName)}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-60">
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
          </div>
        </div>
      </header>

      <main
        className="relative z-10 flex min-h-0 flex-1 overflow-hidden"
        style={
          {
            "--inspector-w": "min(36rem, 46vw)",
          } as React.CSSProperties
        }
      >
        <section
          className={cn(
            "relative flex min-w-0 flex-1 flex-col transition-[margin-right,padding-right] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            panelOpen ? "md:mr-[var(--inspector-w)]" : "md:mr-0",
          )}
          style={{
            paddingRight: panelOpen
              ? "0px"
              : "max(calc((100vw - 48rem) / 2 - 2rem), 0px)",
          }}
        >
          <Conversation className="relative z-10 flex-1">
            <ConversationContent
              className="mx-auto w-full max-w-3xl gap-6 px-3 pb-48 pt-6 md:mx-0 md:ml-auto md:mr-8 md:px-6"
            >
              <ChatMessages
                messages={messageList}
                onSelectStudent={(studentId) => {
                  setSelectedStudentId(studentId);
                  setPanelOpen(true);
                }}
                selectedStudentId={selectedStudentId}
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
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 transition-[padding-right] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              paddingRight: panelOpen
                ? "0px"
                : "max(calc((100vw - 48rem) / 2 - 2rem), 0px)",
            }}
          >
            <div className="px-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:pb-5">
              <div className="pointer-events-auto mx-auto w-full max-w-3xl md:mx-0 md:ml-auto md:mr-8">
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
          aria-hidden={!panelOpen}
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 hidden w-[var(--inspector-w)] max-w-[680px] p-2 pl-0 transition-transform duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none md:block",
            panelOpen
              ? "translate-x-0"
              : "translate-x-[calc(100%+0.25rem)]",
          )}
          role="complementary"
        >
          <div className="pointer-events-auto flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--linear-border)] bg-[var(--chat-panel)] shadow-[var(--shadow-dialog),var(--shadow-ring)]">
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
