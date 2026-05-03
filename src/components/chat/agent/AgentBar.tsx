"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FileUIPart, UIMessage } from "ai";

import { cn } from "@/lib/utils";
import type {
  GradingRunResponse,
  ZipPromptMessage,
} from "@/components/chat/shared/types";
import { ChatMessages } from "@/components/chat/conversation/ChatMessages";
import { ZipPromptInput } from "@/components/chat/agent/ZipPromptInput";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/chat/conversation/primitives/conversation";
import type { LayoutState } from "../results/ResultsPane";

type PillState = "collapsed" | "hover" | "expanded";

type AgentBarProps = {
  attachmentError: string | null;
  detailOpen: boolean;
  error: Error | undefined;
  isModelBusy: boolean;
  layoutState: LayoutState;
  messages: UIMessage[];
  onElapsedSettled: (messageId: string, elapsedMs: number) => void;
  onError: (message: string | null) => void;
  onStop: () => void;
  onSubmit: (message: ZipPromptMessage) => Promise<void>;
  onUploadFile: (file: File) => Promise<FileUIPart>;
  panelData: GradingRunResponse | null;
  runtimeError: string | null;
  userName?: string | null;
};

const cardShadow =
  "shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)]";

type PromptComposerProps = Pick<
  AgentBarProps,
  | "attachmentError"
  | "isModelBusy"
  | "onError"
  | "onStop"
  | "onSubmit"
  | "onUploadFile"
> & {
  className?: string;
};

function PromptComposer({
  attachmentError,
  className,
  isModelBusy,
  onError,
  onStop,
  onSubmit,
  onUploadFile,
}: PromptComposerProps) {
  return (
    <div className={className}>
      {attachmentError ? (
        <p className="mb-2 text-xs text-[var(--linear-danger)]">
          {attachmentError}
        </p>
      ) : null}
      <ZipPromptInput
        accept=".zip,application/zip,application/x-zip-compressed"
        busy={isModelBusy}
        maxFileSize={12 * 1024 * 1024}
        onError={onError}
        onStop={onStop}
        onSubmit={onSubmit}
        onUploadFile={onUploadFile}
      />
    </div>
  );
}

type MessageHistoryProps = Pick<
  AgentBarProps,
  "isModelBusy" | "messages" | "onElapsedSettled" | "userName"
> & {
  className?: string;
  error?: Error;
  runtimeError?: string | null;
};

function MessageHistory({
  className,
  error,
  isModelBusy,
  messages,
  onElapsedSettled,
  runtimeError,
  userName,
}: MessageHistoryProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <ChatMessages
        isModelBusy={isModelBusy}
        messages={messages}
        onAssistantElapsedSettled={onElapsedSettled}
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
    </div>
  );
}

function CollapsedPillButton({
  isModelBusy,
  onClick,
  statusText,
}: {
  isModelBusy: boolean;
  onClick?: () => void;
  statusText: string;
}) {
  return (
    <button
      className="flex h-full w-full items-center gap-3 px-5 text-left"
      onClick={onClick}
      tabIndex={onClick ? 0 : -1}
      type="button"
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full transition-colors",
          isModelBusy
            ? "animate-pulse bg-[var(--linear-accent)]"
            : "bg-[var(--linear-success)]",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-[510] text-[var(--foreground)]">
          {statusText}
        </span>
      </span>
      <span className="shrink-0 text-[11px] text-[var(--chat-text-muted)]">
        Ask
      </span>
    </button>
  );
}

export function AgentBar(props: AgentBarProps) {
  const {
    attachmentError,
    detailOpen,
    error,
    isModelBusy,
    layoutState,
    messages,
    onElapsedSettled,
    onError,
    onStop,
    onSubmit,
    onUploadFile,
    panelData,
    runtimeError,
    userName,
  } = props;

  const [pillState, setPillState] = useState<PillState>("collapsed");
  const portalRoot = typeof document === "undefined" ? null : document.body;
  const expandedRef = useRef<HTMLDivElement>(null);
  const expandedScrollRef = useRef<HTMLDivElement>(null);
  const promptProps = {
    attachmentError,
    isModelBusy,
    onError,
    onStop,
    onSubmit,
    onUploadFile,
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPillState("collapsed");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [detailOpen, layoutState]);

  useEffect(() => {
    if (pillState !== "expanded") return;
    function handleClick(event: MouseEvent) {
      if (expandedRef.current?.contains(event.target as Node)) return;
      setPillState("collapsed");
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pillState]);

  useEffect(() => {
    if (pillState !== "expanded") return;
    const frame = window.requestAnimationFrame(() => {
      const node = expandedScrollRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, pillState]);

  const statusText = isModelBusy
    ? "Thinking..."
    : panelData
      ? `${panelData.assignmentName ?? "Graded"} · ${panelData.students.length} students`
      : "Ready";
  const isResultsLayout = layoutState === "results";
  const isExpanded = pillState === "expanded";
  const placeholderClassName = cn(
    "shrink-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
    isResultsLayout
      ? "pb-5 pt-2"
      : "basis-[54%] pb-5 pt-2",
  );
  const placeholderHeightClassName = isResultsLayout ? "h-12" : "h-full";
  const shellSize = isResultsLayout
    ? isExpanded
      ? {
        height: "360px",
        width: "min(42rem, calc(100vw - 2rem))",
      }
      : {
        height: "48px",
        width: "360px",
      }
    : {
      height: "calc(54vh - 1.75rem)",
      width: "min(58rem, calc(100vw - 2rem))",
    };

  return (
    <>
      <div aria-hidden className={placeholderClassName}>
        <div className={placeholderHeightClassName} />
      </div>

      {portalRoot && createPortal(
        <div
          className={cn(
            "fixed bottom-5 left-1/2 z-[60] will-change-transform",
            "transition-[width,height,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          )}
          style={{
            ...shellSize,
            transform: isResultsLayout && detailOpen
              ? "translateX(calc(50vw - 1rem - 100%))"
              : "translateX(-50%)",
          }}
        >
          <div
            ref={expandedRef}
            className={cn(
              "h-full overflow-hidden transition-[width,height,border-radius,scale,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
              "bg-[var(--linear-panel)]",
              cardShadow,
              isResultsLayout && detailOpen ? "origin-bottom-right" : "origin-center",
              isResultsLayout
                ? cn(
                  isExpanded
                    ? "h-[360px] w-full rounded-2xl"
                    : "h-12 w-full rounded-[28px]",
                  pillState === "hover" && "scale-[1.08] duration-[480ms]",
                )
                : "w-full rounded-2xl",
            )}
            onMouseEnter={() => {
              if (isResultsLayout && pillState === "collapsed") {
                setPillState("hover");
              }
            }}
            onMouseLeave={() => {
              if (isResultsLayout && pillState === "hover") {
                setPillState("collapsed");
              }
            }}
          >
            {!isResultsLayout ? (
              <div className="grid h-full grid-rows-[minmax(0,1fr)_auto]">
                <Conversation className="relative flex-1">
                  <ConversationContent className="gap-5 px-5 pb-3 pt-5">
                    <MessageHistory
                      className="gap-5"
                      error={error}
                      isModelBusy={isModelBusy}
                      messages={messages}
                      onElapsedSettled={onElapsedSettled}
                      runtimeError={runtimeError}
                      userName={userName}
                    />
                  </ConversationContent>
                  <ConversationScrollButton />
                </Conversation>
                <PromptComposer className="px-4 pb-4" {...promptProps} />
              </div>
            ) : isExpanded ? (
              <div className="grid h-full grid-rows-[minmax(0,1fr)_auto]">
                <div
                  className="no-scrollbar min-h-0 overflow-y-auto overscroll-contain px-4 pb-2 pt-3"
                  ref={expandedScrollRef}
                >
                  <MessageHistory
                    isModelBusy={isModelBusy}
                    messages={messages.slice(-4)}
                    onElapsedSettled={onElapsedSettled}
                    userName={userName}
                  />
                </div>
                <PromptComposer className="shrink-0 px-3 pb-3" {...promptProps} />
              </div>
            ) : (
              <CollapsedPillButton
                isModelBusy={isModelBusy}
                onClick={() => setPillState("expanded")}
                statusText={statusText}
              />
            )}
          </div>
        </div>,
        portalRoot,
      )}
    </>
  );
}
