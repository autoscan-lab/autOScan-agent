"use client";

import { useChat } from "@ai-sdk/react";
import {
  isReasoningUIPart,
  isToolUIPart,
  type FileUIPart,
  type ReasoningUIPart,
  type ToolUIPart,
  type DynamicToolUIPart,
  type UIMessage,
} from "ai";
import {
  BrainIcon,
  FileArchiveIcon,
  LogOutIcon,
  PaperclipIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PlayIcon,
  RefreshCwIcon,
  Trash2Icon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PixelBlastBackground = dynamic(
  () => import("@/components/PixelBlast"),
  { ssr: false },
);

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import type { LucideIcon } from "lucide-react";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Types & constants                                                          */
/* -------------------------------------------------------------------------- */

const chatWatchdogMs = 180_000;
const maxZipUploadBytes = 12 * 1024 * 1024;
const zipAcceptAttr = ".zip,application/zip,application/x-zip-compressed";

type ChatProps = {
  initialChatId?: string;
  initialMessages?: UIMessage[];
  userEmail?: string | null;
  userName?: string | null;
};

type UploadResponse = {
  filename?: string;
  mediaType?: string;
  url: string;
};

type StudentInspectorRow = {
  studentId: string;
  status: string | null;
  grade: number | null;
  compileOk: boolean | null;
  testsPassed: string | null;
  bannedCount: number | null;
  notes: string | null;
  sourceText: string | null;
};

type LatestGradingResponse = {
  assignmentName: string | null;
  students: StudentInspectorRow[];
};

type ToolPart = ToolUIPart | DynamicToolUIPart;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function messageDigest(messages: UIMessage[]) {
  return messages
    .map((message) => {
      const partDigest = message.parts
        .map((part) => {
          if (part.type === "text") {
            return `text:${part.text.length}`;
          }
          if (part.type === "file") {
            return `file:${part.filename ?? "unknown"}`;
          }
          if ("state" in part && typeof part.state === "string") {
            return `${part.type}:${part.state}`;
          }
          return part.type;
        })
        .join(",");
      return `${message.id}:${message.role}:${partDigest}`;
    })
    .join("|");
}

/** Humanize a student id like "s0test/student1" → "student1". */
function formatStudentName(studentId: string) {
  const trimmed = studentId.trim();
  const tail = trimmed.split("/").pop();
  return tail && tail.length > 0 ? tail : trimmed;
}

function initialsOf(name: string) {
  const parts = name
    .split(/[\s@.]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function statusTone(status: string | null) {
  const normalized = status?.toLowerCase().trim() ?? "";
  if (!normalized) {
    return "border-[var(--linear-border)] bg-[var(--linear-ghost)] text-[var(--chat-text-muted)]";
  }
  if (normalized.includes("ok") || normalized.includes("pass")) {
    return "border-[#27a644]/35 bg-[#27a644]/15 text-[#27a644]";
  }
  if (normalized.includes("fail") || normalized.includes("error")) {
    return "border-[var(--linear-danger)]/35 bg-[var(--linear-danger)]/12 text-[var(--linear-danger)]";
  }
  return "border-[var(--linear-border)] bg-[var(--linear-ghost)] text-[var(--chat-text-muted)]";
}

function gradeTone(grade: number | null) {
  if (grade === null) {
    return "border-[var(--linear-border)] bg-[var(--linear-ghost)] text-[var(--chat-text-muted)]";
  }
  if (grade >= 90) {
    return "border-[var(--linear-success)]/35 bg-[var(--linear-success)]/15 text-[var(--linear-success)]";
  }
  if (grade >= 70) {
    return "border-[var(--linear-accent)]/35 bg-[var(--linear-accent)]/15 text-[var(--linear-accent-hover)]";
  }
  return "border-[var(--linear-danger)]/35 bg-[var(--linear-danger)]/12 text-[var(--linear-danger)]";
}

/* -------------------------------------------------------------------------- */
/*  Composer (PromptInput) sub-components                                      */
/* -------------------------------------------------------------------------- */

function AttachmentChips() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <PromptInputHeader>
      {attachments.files.map((file) => (
        <span
          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[var(--linear-border)] bg-[var(--linear-ghost)] px-2 py-1 font-mono text-[11px] text-[var(--chat-text-secondary)]"
          key={file.id}
        >
          <FileArchiveIcon className="size-3.5 shrink-0" />
          <span className="truncate">{file.filename ?? file.mediaType}</span>
          <button
            aria-label="Remove attachment"
            className="inline-flex size-4 items-center justify-center rounded-sm text-[var(--chat-text-muted)] transition-colors hover:bg-[var(--linear-ghost-hover)] hover:text-[var(--foreground)]"
            onClick={() => attachments.remove(file.id)}
            type="button"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
    </PromptInputHeader>
  );
}

function AttachButton() {
  const attachments = usePromptInputAttachments();
  return (
    <PromptInputButton
      aria-label="Attach zip"
      onClick={() => attachments.openFileDialog()}
      tooltip="Attach submissions zip"
    >
      <PaperclipIcon className="size-4" />
    </PromptInputButton>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chain of Thought (reasoning + tool) renderers                              */
/* -------------------------------------------------------------------------- */

type ThoughtStep =
  | { kind: "reasoning"; part: ReasoningUIPart }
  | { kind: "tool"; part: ToolPart };

function extractThoughtSteps(message: UIMessage): ThoughtStep[] {
  return message.parts.flatMap((part): ThoughtStep[] => {
    if (isReasoningUIPart(part)) {
      return [{ kind: "reasoning", part }];
    }
    if (isToolUIPart(part)) {
      return [{ kind: "tool", part }];
    }
    return [];
  });
}

function toolNameOf(part: ToolPart) {
  return part.type === "dynamic-tool"
    ? part.toolName
    : part.type.replace(/^tool-/, "");
}

function prettyToolTitle(toolName: string) {
  return toolName
    .split("_")
    .map((segment) =>
      segment.length > 0
        ? segment.charAt(0).toUpperCase() + segment.slice(1)
        : segment,
    )
    .join(" ");
}

const toolIconMap: Record<string, LucideIcon> = {
  grade_submissions: PlayIcon,
};

function iconForTool(toolName: string): LucideIcon {
  return toolIconMap[toolName] ?? WrenchIcon;
}

type ToolSummary = {
  label: string;
  description?: string;
  chips: string[];
};

function summarizeTool(toolName: string, part: ToolPart): ToolSummary {
  const input = ("input" in part ? part.input : undefined) as
    | Record<string, unknown>
    | undefined;
  const output = ("output" in part ? part.output : undefined) as unknown;
  const isRunning =
    part.state === "input-streaming" || part.state === "input-available";

  const str = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim().length > 0 ? value : undefined;
  const num = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;

  switch (toolName) {
    case "grade_submissions": {
      const assignment =
        str(input?.assignment_name) ??
        (output && typeof output === "object"
          ? str((output as Record<string, unknown>).assignmentName)
          : undefined);
      const count =
        output && typeof output === "object"
          ? num((output as Record<string, unknown>).studentCount)
          : undefined;

      if (isRunning) {
        return {
          chips: [],
          label: assignment
            ? `Grading ${assignment}…`
            : "Grading submissions…",
        };
      }

      return {
        chips: [],
        description:
          count !== undefined
            ? `Finished ${count} submission${count === 1 ? "" : "s"}`
            : undefined,
        label: assignment ? `Graded ${assignment}` : "Graded submissions",
      };
    }

    default: {
      return {
        chips: [],
        label: isRunning
          ? `${prettyToolTitle(toolName)}…`
          : prettyToolTitle(toolName),
      };
    }
  }
}

function ReasoningStepItem({ part }: { part: ReasoningUIPart }) {
  const isActive = part.state === "streaming";
  const text = part.text?.trim();
  return (
    <ChainOfThoughtStep
      icon={BrainIcon}
      label={isActive ? "Thinking…" : "Reasoning"}
      status={isActive ? "active" : "complete"}
    >
      {text ? (
        <div className="whitespace-pre-wrap rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] p-2.5 font-mono text-[11.5px] leading-[1.55] text-[var(--chat-text-muted)]">
          {text}
        </div>
      ) : null}
    </ChainOfThoughtStep>
  );
}

function ToolStepItem({ part }: { part: ToolPart }) {
  const toolName = toolNameOf(part);
  const isRunning =
    part.state === "input-streaming" || part.state === "input-available";
  const isError = part.state === "output-error";
  const errorText = "errorText" in part ? part.errorText : undefined;
  const summary = summarizeTool(toolName, part);

  const status: "active" | "complete" | "pending" = isRunning
    ? "active"
    : "complete";

  return (
    <ChainOfThoughtStep
      description={isError ? errorText ?? "Tool failed." : summary.description}
      icon={iconForTool(toolName)}
      label={
        <span
          className={cn(
            "text-[13px] font-[510]",
            isError && "text-[var(--linear-danger)]",
          )}
        >
          {summary.label}
        </span>
      }
      status={status}
    >
      {summary.chips.length > 0 ? (
        <ChainOfThoughtSearchResults>
          {summary.chips.map((chip) => (
            <ChainOfThoughtSearchResult
              className="border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] text-[var(--chat-text-secondary)]"
              key={chip}
            >
              {chip}
            </ChainOfThoughtSearchResult>
          ))}
        </ChainOfThoughtSearchResults>
      ) : null}
    </ChainOfThoughtStep>
  );
}

function stepActivity(step: ThoughtStep) {
  if (step.kind === "reasoning") {
    return step.part.state === "streaming";
  }
  const state = step.part.state;
  return state === "input-streaming" || state === "input-available";
}

function AssistantThoughtTrail({ message }: { message: UIMessage }) {
  const steps = useMemo(() => extractThoughtSteps(message), [message]);
  const anyActive = useMemo(() => steps.some(stepActivity), [steps]);

  const [open, setOpen] = useState(anyActive);
  const prevActive = useRef(anyActive);
  useEffect(() => {
    if (prevActive.current !== anyActive) {
      prevActive.current = anyActive;
      setOpen(anyActive);
    }
  }, [anyActive]);

  if (steps.length === 0) {
    return null;
  }

  const label = anyActive
    ? "Thinking…"
    : `Thought through ${steps.length} step${steps.length === 1 ? "" : "s"}`;

  return (
    <ChainOfThought
      className="w-full space-y-3"
      onOpenChange={setOpen}
      open={open}
    >
      <ChainOfThoughtHeader className="text-[var(--chat-text-muted)] hover:text-[var(--foreground)]">
        <span className="flex-1 text-left font-[510]">{label}</span>
      </ChainOfThoughtHeader>
      <ChainOfThoughtContent className="ml-1 border-l border-[var(--linear-border-subtle)] pl-3">
        {steps.map((step, index) =>
          step.kind === "reasoning" ? (
            <ReasoningStepItem
              key={`${message.id}-step-${index}`}
              part={step.part}
            />
          ) : (
            <ToolStepItem
              key={`${message.id}-step-${index}`}
              part={step.part}
            />
          ),
        )}
      </ChainOfThoughtContent>
    </ChainOfThought>
  );
}

function FileChip({ part }: { part: FileUIPart }) {
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-md border border-[var(--linear-border)] bg-[var(--linear-ghost)] px-2 py-1 font-mono text-[12px] text-[var(--chat-text-secondary)]">
      <FileArchiveIcon className="size-3.5 shrink-0" />
      <span className="truncate">{part.filename ?? part.mediaType}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Inspector                                                                  */
/* -------------------------------------------------------------------------- */

type InspectorProps = {
  data: LatestGradingResponse | null;
  error: string | null;
  loading: boolean;
  selectedStudentId: string | null;
  setSelectedStudentId: (id: string | null) => void;
};

function InspectorPanel({
  data,
  error,
  loading,
  selectedStudentId,
  setSelectedStudentId,
}: InspectorProps) {
  const students = useMemo(() => data?.students ?? [], [data?.students]);
  const selectedStudent = useMemo(() => {
    if (students.length === 0) {
      return null;
    }
    return (
      students.find((s) => s.studentId === selectedStudentId) ?? students[0]
    );
  }, [students, selectedStudentId]);

  const hasStudents = students.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Pane header — only shown when there is data to describe */}
      {hasStudents ? (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--linear-border-subtle)] px-4 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--chat-text-muted)]">
              Inspector
            </p>
            {data?.assignmentName ? (
              <p className="mt-0.5 truncate text-[15px] font-[510] leading-tight text-[var(--foreground)]">
                {data.assignmentName}
              </p>
            ) : null}
          </div>
          <span className="shrink-0 font-mono text-[11px] text-[var(--chat-text-muted)]">
            <span className="font-[510] text-[var(--chat-text-secondary)]">
              {students.length}
            </span>{" "}
            student{students.length === 1 ? "" : "s"}
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="mx-4 mt-4 rounded-md border border-[var(--linear-danger)]/35 bg-[var(--linear-danger)]/10 px-3 py-2 text-sm text-[var(--linear-danger)]">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--chat-text-muted)]">
          <RefreshCwIcon className="mr-2 size-4 animate-spin" />
          Loading…
        </div>
      ) : !hasStudents ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[13px] text-[var(--chat-text-muted)]">
          No grading results yet
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[13rem,1fr]">
          {/* Student list */}
          <div className="min-h-0 overflow-y-auto border-r border-[var(--linear-border-subtle)] py-1">
            {students.map((student) => {
              const active = selectedStudent?.studentId === student.studentId;
              return (
                <button
                  className={cn(
                    "relative flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-[var(--linear-ghost)]",
                    active && "bg-[var(--linear-ghost)]",
                  )}
                  key={student.studentId}
                  onClick={() => setSelectedStudentId(student.studentId)}
                  type="button"
                >
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-[var(--linear-accent)]"
                    />
                  ) : null}
                  <div className="font-mono text-[12px] text-[var(--foreground)]">
                    {formatStudentName(student.studentId)}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[10px] font-[510] leading-none",
                        statusTone(student.status),
                      )}
                    >
                      {student.status ?? "—"}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[10px] font-[510] leading-none tabular-nums",
                        gradeTone(student.grade),
                      )}
                    >
                      {student.grade === null ? "—" : student.grade}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail view */}
          <div className="min-h-0 overflow-y-auto p-4">
            {selectedStudent ? (
              <div className="space-y-4">
                {/* Hero: student id + grade */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--chat-text-muted)]">
                      Student
                    </p>
                    <p className="mt-1 truncate font-mono text-[18px] font-[510] text-[var(--foreground)]">
                      {formatStudentName(selectedStudent.studentId)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--chat-text-muted)]">
                      Grade
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 font-heading text-[36px] font-[510] leading-none tracking-[-0.04em] tabular-nums",
                        selectedStudent.grade === null
                          ? "text-[var(--chat-text-muted)]"
                          : selectedStudent.grade >= 90
                            ? "text-[var(--linear-success)]"
                            : selectedStudent.grade >= 70
                              ? "text-[var(--foreground)]"
                              : "text-[var(--linear-danger)]",
                      )}
                    >
                      {selectedStudent.grade === null
                        ? "—"
                        : selectedStudent.grade}
                    </p>
                  </div>
                </div>

                {/* Status pill */}
                <div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-[510]",
                      statusTone(selectedStudent.status),
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {selectedStudent.status ?? "unknown"}
                  </span>
                </div>

                {/* Metric strip */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: "Compile",
                      value:
                        selectedStudent.compileOk === null
                          ? "—"
                          : selectedStudent.compileOk
                            ? "passes"
                            : "fails",
                      tone:
                        selectedStudent.compileOk === true
                          ? "text-[var(--linear-success)]"
                          : selectedStudent.compileOk === false
                            ? "text-[var(--linear-danger)]"
                            : "text-[var(--chat-text-muted)]",
                    },
                    {
                      label: "Tests",
                      value: selectedStudent.testsPassed ?? "—",
                      tone: "text-[var(--foreground)]",
                    },
                    {
                      label: "Banned",
                      value:
                        selectedStudent.bannedCount === null
                          ? "—"
                          : selectedStudent.bannedCount === 0
                            ? "none"
                            : String(selectedStudent.bannedCount),
                      tone:
                        selectedStudent.bannedCount &&
                        selectedStudent.bannedCount > 0
                          ? "text-[var(--linear-danger)]"
                          : "text-[var(--foreground)]",
                    },
                  ].map((metric) => (
                    <div
                      className="rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] px-2.5 py-2"
                      key={metric.label}
                    >
                      <p className="font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--chat-text-muted)]">
                        {metric.label}
                      </p>
                      <p
                        className={cn(
                          "mt-1 truncate text-[13px] font-[510] tabular-nums",
                          metric.tone,
                        )}
                      >
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Grader notes */}
                {selectedStudent.notes ? (
                  <div className="rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] p-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--chat-text-muted)]">
                      Notes
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--chat-text-secondary)]">
                      {selectedStudent.notes}
                    </p>
                  </div>
                ) : null}

                {/* Submitted source */}
                {selectedStudent.sourceText ? (
                  <details className="group rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[12px] font-[510] text-[var(--chat-text-secondary)] hover:text-[var(--foreground)]">
                      <span className="font-mono uppercase tracking-[0.04em] text-[var(--chat-text-muted)]">
                        Submitted source
                      </span>
                      <span className="text-[11px] text-[var(--chat-text-muted)] transition group-open:rotate-180">
                        ▾
                      </span>
                    </summary>
                    <pre className="max-h-80 overflow-auto border-t border-[var(--linear-border-subtle)] bg-[var(--linear-panel)] p-3 font-mono text-[12px] leading-[1.55] text-[var(--foreground)]">
                      {selectedStudent.sourceText}
                    </pre>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chat                                                                       */
/* -------------------------------------------------------------------------- */

export function Chat({
  initialChatId,
  initialMessages,
  userEmail,
  userName,
}: ChatProps) {
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelData, setPanelData] = useState<LatestGradingResponse | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );

  const lastPersistedDigest = useRef(messageDigest(initialMessages ?? []));
  const lastPanelSyncDigest = useRef<string | null>(null);
  const lastGradedCallId = useRef<string | null>(null);

  const { error, id, messages, sendMessage, setMessages, status, stop } =
    useChat({
      id: initialChatId,
      messages: initialMessages,
      experimental_throttle: 80,
    });

  const isModelBusy = status === "submitted" || status === "streaming";
  const displayName = userName || userEmail || "User";
  const messageList = useMemo(() => messages ?? [], [messages]);

  const persistChatState = useCallback(
    async (nextMessages: UIMessage[]) => {
      const digest = messageDigest(nextMessages);
      if (!digest || digest === lastPersistedDigest.current) {
        return;
      }

      const response = await fetch("/api/chat/state", {
        body: JSON.stringify({
          chatId: id,
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
    [id],
  );

  const refreshPanelData = useCallback(async () => {
    setPanelLoading(true);
    setPanelError(null);

    try {
      const response = await fetch("/api/grading/latest", { method: "GET" });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || "Could not load latest grading results.");
      }
      const payload = (await response.json()) as LatestGradingResponse;
      setPanelData(payload);

      setSelectedStudentId((current) => {
        const exists = payload.students.some(
          (student) => student.studentId === current,
        );
        if (exists) {
          return current;
        }
        return payload.students[0]?.studentId ?? null;
      });
    } catch (refreshError) {
      setPanelError(
        refreshError instanceof Error
          ? refreshError.message
          : "Could not load latest grading results.",
      );
    } finally {
      setPanelLoading(false);
    }
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
    setPanelData(null);
    setSelectedStudentId(null);
    setPanelError(null);
    setPanelOpen(false);
    lastPersistedDigest.current = messageDigest([]);
    lastPanelSyncDigest.current = null;
    lastGradedCallId.current = null;
  }, [setMessages]);

  const handlePromptSubmit = useCallback(
    async (message: PromptInputMessage) => {
      setRuntimeError(null);
      setAttachmentError(null);

      const trimmedText = message.text?.trim() ?? "";
      if (!trimmedText && message.files.length === 0) {
        return;
      }

      try {
        const uploaded: FileUIPart[] = await Promise.all(
          message.files.map(async (part) => {
            if (!part.url.startsWith("data:") && !part.url.startsWith("blob:")) {
              return part;
            }
            const response = await fetch(part.url);
            const blob = await response.blob();
            const file = new File(
              [blob],
              part.filename ?? "submissions.zip",
              { type: part.mediaType || blob.type || "application/zip" },
            );
            return uploadAttachment(file);
          }),
        );

        if (uploaded.length > 0 && trimmedText) {
          await sendMessage({ files: uploaded, text: trimmedText });
        } else if (uploaded.length > 0) {
          await sendMessage({ files: uploaded });
        } else {
          await sendMessage({ text: trimmedText });
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
    [sendMessage, uploadAttachment],
  );

  /* -------- persistence + panel sync -------- */

  useEffect(() => {
    if (status !== "ready" && status !== "error") {
      return;
    }
    if (messageList.length === 0) {
      return;
    }
    void persistChatState(messageList).catch(() => {
      // Keep the chat interactive even if persistence fails transiently.
    });
  }, [messageList, persistChatState, status]);

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

  // Refresh the inspector when the conversation settles (new tool output or
  // completed turn). The digest guard avoids thrashing while streaming.
  useEffect(() => {
    if (status !== "ready") {
      return;
    }
    const digest = messageDigest(messageList);
    if (digest === lastPanelSyncDigest.current) {
      return;
    }
    lastPanelSyncDigest.current = digest;
    void refreshPanelData();
  }, [messageList, refreshPanelData, status]);

  // Auto-open the inspector the moment a grade_submissions call returns a
  // result. We key off the tool call id so re-runs of the same assignment
  // still trigger an open.
  useEffect(() => {
    for (let i = messageList.length - 1; i >= 0; i--) {
      const message = messageList[i];
      if (message.role !== "assistant") {
        continue;
      }
      for (const part of message.parts) {
        if (!isToolUIPart(part)) {
          continue;
        }
        const toolName =
          part.type === "dynamic-tool"
            ? part.toolName
            : part.type.replace(/^tool-/, "");
        if (
          toolName !== "grade_submissions" ||
          part.state !== "output-available"
        ) {
          continue;
        }
        const callId = part.toolCallId;
        if (!callId || callId === lastGradedCallId.current) {
          continue;
        }
        lastGradedCallId.current = callId;
        setPanelOpen(true);
        return;
      }
    }
  }, [messageList]);

  /* -------- render -------- */

  const inspectorNode = (
    <InspectorPanel
      data={panelData}
      error={panelError}
      loading={panelLoading}
      selectedStudentId={selectedStudentId}
      setSelectedStudentId={setSelectedStudentId}
    />
  );

  return (
    <div className="relative flex h-screen flex-col text-[var(--foreground)]">
      {/* Subtle app shell color under the shader (keeps text readable if WebGL hiccups). */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[var(--chat-bg)]"
      />
      {/* Global animated pixel background — one mount; inspector toggle does not re-init Three. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] opacity-40 mix-blend-screen"
      >
        <PixelBlastBackground
          variant="square"
          color="#1c1c1c"
          pixelSize={3}
          patternScale={2}
          patternDensity={1}
          pixelSizeJitter={0}
          enableRipples={true}
          speed={0.4}
          edgeFade={0.25}
          transparent
          autoPauseOffscreen
        />
      </div>

      {/* ------------------------------- Header ------------------------------- */}
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
                    isModelBusy ||
                    isClearingHistory ||
                    messageList.length === 0
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
                  {isClearingHistory ? "Clearing…" : "Clear chat"}
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

      {/* --------------------------- Main layout ----------------------------
           Inspector is always mounted + absolutely positioned so we can
           animate its translate-x alongside the chat column's margin-right.
           Both use the same duration/easing → clean "push + slide" motion. */}
      <main
        className="relative z-10 flex min-h-0 flex-1 overflow-hidden"
        style={
          {
            "--inspector-w": "min(28rem, 40vw)",
          } as React.CSSProperties
        }
      >
        {/* ----- Chat column ----- */}
        <section
          className={cn(
            "relative flex min-w-0 flex-1 flex-col transition-[margin-right] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            panelOpen ? "md:mr-[var(--inspector-w)]" : "md:mr-0",
          )}
        >
          <Conversation className="relative z-10 flex-1">
            <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-3 pb-48 pt-6 md:px-6">
              {messageList.length === 0 ? (
                <ConversationEmptyState className="gap-3 pt-32">
                  <h2 className="font-heading text-[32px] font-[510] leading-[1.1] tracking-[-0.025em] text-[var(--foreground)]">
                    What are we grading today?
                  </h2>
                  <p className="text-[14px] leading-relaxed text-[var(--chat-text-muted)]">
                    Attach submissions and ask for a grade
                  </p>
                </ConversationEmptyState>
              ) : (
                messageList.map((message) => {
                  const isAssistant = message.role === "assistant";
                  const hasThoughts =
                    isAssistant &&
                    message.parts.some(
                      (part) => isReasoningUIPart(part) || isToolUIPart(part),
                    );
                  return (
                    <Message
                      className={isAssistant ? "max-w-full" : undefined}
                      from={message.role}
                      key={message.id}
                    >
                      <MessageContent
                        className={cn(
                          "gap-3",
                          isAssistant && "w-full max-w-full",
                        )}
                      >
                        {hasThoughts ? (
                          <AssistantThoughtTrail message={message} />
                        ) : null}
                        {message.parts.map((part, index) => {
                          const key = `${message.id}-${index}`;

                          if (part.type === "text") {
                            return (
                              <MessageResponse key={key}>
                                {part.text}
                              </MessageResponse>
                            );
                          }

                          if (part.type === "file") {
                            return <FileChip key={key} part={part} />;
                          }

                          return null;
                        })}
                      </MessageContent>
                    </Message>
                  );
                })
              )}

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

          {/* --------------------------- Composer --------------------------
               Floating over the conversation. There is no visible separator —
               content scrolls behind and fades into the background via the
               gradient. The composer card is the only thing drawn solidly. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
            <div className="px-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:pb-5">
              <div className="pointer-events-auto mx-auto w-full max-w-3xl">
                {attachmentError ? (
                  <p className="mb-2 text-xs text-[var(--linear-danger)]">
                    {attachmentError}
                  </p>
                ) : null}

                <PromptInput
                  accept={zipAcceptAttr}
                  className="[&>[data-slot=input-group]]:rounded-xl [&>[data-slot=input-group]]:border-[var(--linear-border)] [&>[data-slot=input-group]]:bg-[var(--linear-panel)] [&>[data-slot=input-group]]:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.02)] [&>[data-slot=input-group]]:transition-[border-color,box-shadow] [&>[data-slot=input-group]]:duration-150"
                  maxFileSize={maxZipUploadBytes}
                  maxFiles={1}
                  onError={(err) => setAttachmentError(err.message)}
                  onSubmit={handlePromptSubmit}
                >
                  <AttachmentChips />
                  <PromptInputTextarea
                    className="min-h-[84px] max-h-56 px-4 py-3 text-[15px] leading-relaxed text-[var(--foreground)] placeholder:text-[var(--chat-text-muted)]"
                    placeholder="Attach a zip and ask for grading…"
                  />
                  <PromptInputFooter className="px-3 pb-2.5">
                    <PromptInputTools>
                      <AttachButton />
                    </PromptInputTools>
                    <PromptInputSubmit
                      className="rounded-md border-transparent bg-primary !text-primary-foreground shadow-[var(--shadow-ring)] hover:bg-[var(--linear-accent-hover)] [&_svg]:!text-primary-foreground"
                      onStop={stop}
                      status={status}
                    />
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </div>
          </div>
        </section>

        {/* ----- Inspector pane — absolute so it can slide as a whole ----- */}
        <aside
          aria-hidden={!panelOpen}
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 hidden w-[var(--inspector-w)] max-w-[520px] p-3 pl-0 transition-transform duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none md:block",
            panelOpen
              ? "translate-x-0"
              : "translate-x-[calc(100%+0.25rem)]",
          )}
          role="complementary"
        >
          <div
            className={cn(
              "pointer-events-auto flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--linear-border)] bg-[var(--chat-panel)] shadow-[var(--shadow-dialog),var(--shadow-ring)]",
            )}
          >
            {inspectorNode}
          </div>
        </aside>
      </main>

      {/* Mobile overlay — panel stays mounted so it can animate out */}
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
