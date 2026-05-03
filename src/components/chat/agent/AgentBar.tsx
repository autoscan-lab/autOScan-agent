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
  const [portalMounted, setPortalMounted] = useState(false);
  const expandedRef = useRef<HTMLDivElement>(null);
  const promptProps = {
    attachmentError,
    isModelBusy,
    onError,
    onStop,
    onSubmit,
    onUploadFile,
  };

  useEffect(() => { setPortalMounted(true); }, []);

  // Collapse pill whenever the detail state toggles so the position
  // transition always starts from the 360px collapsed width.
  useEffect(() => { setPillState("collapsed"); }, [detailOpen]);

  useEffect(() => {
    if (pillState !== "expanded") return;
    function handleClick(event: MouseEvent) {
      if (expandedRef.current?.contains(event.target as Node)) return;
      setPillState("collapsed");
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pillState]);

  if (layoutState !== "results") {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-col items-center px-4 transition-all duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          layoutState === "empty"
            ? "basis-[54%] shrink-0 justify-end pb-5 pt-2"
            : "h-[500px] shrink-0 justify-end pb-5 pt-2",
        )}
      >
        <div
          className={cn(
            "flex w-full max-w-[56rem] flex-col overflow-hidden rounded-2xl bg-[var(--linear-panel)]",
            "h-full",
            cardShadow,
          )}
        >
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
      </div>
    );
  }

  const statusText = isModelBusy
    ? "Thinking..."
    : panelData
      ? `${panelData.assignmentName ?? "Graded"} · ${panelData.students.length} students`
      : "Ready";
  const isExpanded = pillState === "expanded";
  const expandedWidth = "w-[min(42rem,calc(100vw-2rem))]";

  // The pill is always portaled to document.body to escape <main>'s z-10 stacking
  // context, ensuring it sits above the DetailDrawer curtain (z-50) at z-60.
  //
  // Position is driven entirely by translateX on a left:50% anchor:
  //   centered  → translateX(-50%)              pill center at 50vw
  //   bottom-right → translateX(calc(50vw-376px)) right edge 16px from viewport right
  //
  // CSS transitions between these two values because both resolve to px offsets,
  // giving the slide animation when the detail drawer opens/closes.
  return (
    <>
      {/* Flow placeholder keeps ResultsPane from filling the full height */}
      <div aria-hidden className="shrink-0 pb-5 pt-2">
        <div className="h-12" />
      </div>

      {portalMounted && createPortal(
        <div
          className={cn(
            "fixed bottom-5 z-[60] will-change-transform",
            "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          )}
          style={{
            left: "50%",
            transform: detailOpen
              ? "translateX(calc(50vw - 1rem - 100%))"
              : "translateX(-50%)",
          }}
        >
          <div
            ref={expandedRef}
            className={cn(
              "overflow-hidden transition-[width,height,border-radius,scale,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
              "bg-[var(--linear-panel)]",
              cardShadow,
              detailOpen ? "origin-bottom-right" : "origin-center",
              isExpanded ? cn("h-[360px] rounded-2xl", expandedWidth) : "w-[360px] rounded-[28px]",
              pillState === "collapsed"
                ? "h-12 duration-300"
                : pillState === "hover"
                  ? "h-12 scale-[1.08] duration-[480ms]"
                  : "h-[360px]",
            )}
            onMouseEnter={() => {
              if (pillState === "collapsed") setPillState("hover");
            }}
            onMouseLeave={() => {
              if (pillState === "hover") setPillState("collapsed");
            }}
          >
            {isExpanded ? (
              <div className="grid h-full grid-rows-[minmax(0,1fr)_auto]">
                <div className="no-scrollbar min-h-0 overflow-y-auto overscroll-contain px-4 pb-2 pt-3">
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
              <button
                className="flex h-full w-full items-center gap-3 px-5 text-left"
                onClick={() => setPillState("expanded")}
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
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
