"use client";

import {
  isReasoningUIPart,
  isToolUIPart,
  type DynamicToolUIPart,
  type FileUIPart,
  type ReasoningUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai";
import {
  BotIcon,
  BrainIcon,
  FileArchiveIcon,
  ScanSearchIcon,
  WrenchIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/chat/ai-elements/chain-of-thought";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/chat/ai-elements/message";
import {
  firstNameOf,
  formatStudentName,
} from "@/components/chat/support/display";
import { DittoThinking } from "@/components/chat/messages/DittoThinking";
import { cn } from "@/lib/utils";

type ToolPart = ToolUIPart | DynamicToolUIPart;

type ThoughtStep =
  | { kind: "reasoning"; part: ReasoningUIPart }
  | { kind: "tool"; part: ToolPart };

type ChatMessagesProps = {
  isModelBusy?: boolean;
  messages: UIMessage[];
  onAssistantElapsedSettled?: (messageId: string, elapsedMs: number) => void;
  onSelectStudent?: (studentId: string) => void;
  selectedStudentId?: string | null;
  userName?: string | null;
};

type GradingResultRow = {
  bannedCount: number | null;
  compileOk: boolean | null;
  grade: string | null;
  status: string;
  studentId: string;
};

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
  check_ai_detection: BotIcon,
  check_similarity: ScanSearchIcon,
  grade_submissions: WrenchIcon,
};

function iconForTool(toolName: string): LucideIcon {
  return toolIconMap[toolName] ?? WrenchIcon;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function messageMetadata(message: UIMessage) {
  return recordOf(message.metadata);
}

function messageElapsedMs(message: UIMessage) {
  const value = messageMetadata(message)?.elapsedMs;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

function stringOf(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function assignmentNameFromToolPart(part: ToolPart) {
  const input = recordOf("input" in part ? part.input : undefined);
  const output = recordOf("output" in part ? part.output : undefined);
  return stringOf(input?.assignment_name) ?? stringOf(output?.assignmentName);
}

function toolCallLabel(toolName: string, isRunning: boolean) {
  return isRunning ? `Calling ${toolName}...` : `Called ${toolName}`;
}

function toolStepLabel(
  toolName: string,
  isRunning: boolean,
  assignment?: string,
) {
  switch (toolName) {
    case "check_similarity": {
      return toolCallLabel(toolName, isRunning);
    }

    case "check_ai_detection": {
      return toolCallLabel(toolName, isRunning);
    }

    case "grade_submissions": {
      return `${isRunning ? "Calling" : "Called"} grade_submissions${
        assignment ? `(${assignment})` : ""
      }${isRunning ? "..." : ""}`;
    }

    default: {
      return isRunning
        ? `Calling ${toolName}...`
        : `Called ${prettyToolTitle(toolName)}`;
    }
  }
}

function thoughtTrailTitle(steps: ThoughtStep[]) {
  for (const step of steps) {
    if (step.kind !== "tool") {
      continue;
    }
    const toolName = toolNameOf(step.part);
    if (toolName === "grade_submissions") {
      const assignment = assignmentNameFromToolPart(step.part);
      return assignment ? `Grade ${assignment}` : "Grade submissions";
    }
    if (toolName === "check_similarity") return "Similarity";
    if (toolName === "check_ai_detection") return "AI detection";
    return prettyToolTitle(toolName);
  }
  return "Tool activity";
}

function ReasoningStepItem({
  part,
}: {
  part: ReasoningUIPart;
}) {
  const isActive = part.state === "streaming";
  return (
    <ChainOfThoughtStep
      icon={BrainIcon}
      label={isActive ? "Calling tools..." : "Tools called"}
      status={isActive ? "active" : "complete"}
    />
  );
}

function ToolStepItem({
  part,
}: {
  part: ToolPart;
}) {
  const toolName = toolNameOf(part);
  const isRunning =
    part.state === "input-streaming" || part.state === "input-available";
  const isError = part.state === "output-error";
  const errorText = "errorText" in part ? part.errorText : undefined;
  const label = toolStepLabel(
    toolName,
    isRunning,
    assignmentNameFromToolPart(part),
  );

  return (
    <ChainOfThoughtStep
      description={isError ? (errorText ?? "Tool failed.") : undefined}
      icon={iconForTool(toolName)}
      label={
        <span
          className={cn(
            "text-[13px] font-[510]",
            isError && "text-[var(--linear-danger)]",
          )}
        >
          {label}
        </span>
      }
      status={isRunning ? "active" : "complete"}
    />
  );
}

function stepActivity(step: ThoughtStep) {
  if (step.kind === "reasoning") {
    return step.part.state === "streaming";
  }
  const state = step.part.state;
  return state === "input-streaming" || state === "input-available";
}

function AssistantThoughtTrail({
  steps,
}: {
  steps: ThoughtStep[];
}) {
  const stepsActive = useMemo(() => steps.some(stepActivity), [steps]);
  const anyActive = stepsActive;

  const [open, setOpen] = useState(false);

  if (steps.length === 0) {
    return null;
  }

  const visibleSteps = steps.some((step) => step.kind === "tool")
    ? steps.filter((step) => step.kind === "tool")
    : steps;
  const title = thoughtTrailTitle(steps);
  const statusText = anyActive ? "Calling tools..." : "Tools called";

  return (
    <ChainOfThought
      className="w-full space-y-3"
      onOpenChange={setOpen}
      open={open}
    >
      <ChainOfThoughtHeader
        className="text-[var(--chat-text-muted)] hover:text-[var(--foreground)]"
        leading={null}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="max-w-[12rem] truncate rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--chat-text-secondary)]">
            {title}
          </span>
          <span className="truncate font-[510]">{statusText}</span>
        </span>
      </ChainOfThoughtHeader>
      <ChainOfThoughtContent className="ml-1 border-l border-[var(--linear-border-subtle)] pl-3">
        {visibleSteps.map((step, index) =>
          step.kind === "reasoning" ? (
            <ReasoningStepItem
              key={`step-${index}`}
              part={step.part}
            />
          ) : (
            <ToolStepItem
              key={`step-${index}`}
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

function isFailedStatus(status: string) {
  const normalized = status.toLowerCase();
  return (
    normalized.includes("fail") ||
    normalized.includes("error") ||
    normalized.includes("timed")
  );
}

function rowState(row: GradingResultRow) {
  if (row.compileOk === false || isFailedStatus(row.status)) {
    return "failed";
  }
  if (
    (row.bannedCount ?? 0) > 0 ||
    row.status.toLowerCase().includes("banned")
  ) {
    return "banned";
  }
  return "clean";
}

type RowState = ReturnType<typeof rowState>;
const rowStatusLabelMap: Record<RowState, string> = {
  banned: "banned",
  clean: "clean",
  failed: "failed",
};
const rowStatusToneMap: Record<RowState, string> = {
  banned: "text-orange-300",
  clean: "text-[var(--linear-success)]",
  failed: "text-[var(--linear-danger)]",
};

function gradeTone(grade: string) {
  const numericGrade = Number.parseFloat(grade);
  if (!Number.isFinite(numericGrade)) {
    return "text-[var(--chat-text-secondary)]";
  }
  if (numericGrade >= 5 && numericGrade <= 10) {
    return "text-[var(--linear-success)]";
  }
  if (numericGrade < 5) {
    return "text-[var(--linear-danger)]";
  }

  return "text-[var(--chat-text-secondary)]";
}

function fallbackGradeLabel(state: RowState) {
  if (state === "failed" || state === "banned") {
    return "2";
  }
  return "check later";
}

function rowPresentation(row: GradingResultRow) {
  const state = rowState(row);
  const grade = row.grade ?? fallbackGradeLabel(state);
  return {
    grade,
    gradeTone: gradeTone(grade),
    statusLabel: rowStatusLabelMap[state],
    statusTone: rowStatusToneMap[state],
  };
}

function extractGradingRows(part: ToolPart): GradingResultRow[] {
  if (!("output" in part) || !part.output || typeof part.output !== "object") {
    return [];
  }
  const students = (part.output as Record<string, unknown>).students;
  if (!Array.isArray(students)) {
    return [];
  }

  return students.flatMap((entry): GradingResultRow[] => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const row = entry as Record<string, unknown>;
    const studentId = typeof row.studentId === "string" ? row.studentId : "";
    if (!studentId) {
      return [];
    }
    const resultRow: GradingResultRow = {
      bannedCount: typeof row.bannedCount === "number" ? row.bannedCount : null,
      compileOk: typeof row.compileOk === "boolean" ? row.compileOk : null,
      grade:
        typeof row.grade === "number" || typeof row.grade === "string"
          ? String(row.grade)
          : null,
      status: typeof row.status === "string" ? row.status : "-",
      studentId,
    };

    return [resultRow];
  });
}

const gradingColumnTemplate =
  "minmax(10rem,1.6fr) minmax(6rem,1fr) minmax(6rem,1fr)";
const gradingHeaders = ["Student", "status", "grade"];

function GradingResultsTable({
  onSelectStudent,
  part,
  selectedStudentId,
}: {
  onSelectStudent?: (studentId: string) => void;
  part: ToolPart;
  selectedStudentId?: string | null;
}) {
  const rows = useMemo(() => extractGradingRows(part), [part]);
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--linear-border)] bg-[var(--linear-panel)] shadow-[0_16px_44px_-28px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="min-w-full">
        <div
          className="grid border-b border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--chat-text-muted)]"
          style={{ gridTemplateColumns: gradingColumnTemplate }}
        >
          {gradingHeaders.map((header) => (
            <div
              className="px-4 py-2.5 text-left font-[510]"
              key={header}
            >
              {header}
            </div>
          ))}
        </div>

        <div>
          {rows.map((row) => {
            const active = row.studentId === selectedStudentId;
            const presentation = rowPresentation(row);
            return (
              <button
                aria-pressed={active}
                className={cn(
                  "group relative grid w-full min-w-full border-b border-[var(--linear-border-subtle)] text-left text-sm transition-colors last:border-b-0 hover:bg-[var(--linear-ghost-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--linear-accent)]",
                  active && "bg-[var(--linear-accent)]/10",
                )}
                key={row.studentId}
                onClick={() => onSelectStudent?.(row.studentId)}
                style={{ gridTemplateColumns: gradingColumnTemplate }}
                type="button"
              >
                <span className="min-w-0 px-4 py-2.5 align-top font-[510] text-foreground">
                  <span className="truncate">
                    {formatStudentName(row.studentId)}
                  </span>
                </span>
                <span
                  className={cn(
                    "min-w-0 px-4 py-2.5 align-top font-[510]",
                    presentation.statusTone,
                  )}
                >
                  <span className="truncate">{presentation.statusLabel}</span>
                </span>
                <span
                  className={cn(
                    "min-w-0 px-4 py-2.5 align-top font-mono text-[12px] font-[510]",
                    presentation.gradeTone,
                  )}
                >
                  <span
                    className="truncate"
                  >
                    {presentation.grade}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function buildWelcomeText(userName?: string | null) {
  const firstName = firstNameOf(userName);
  const greeting = firstName ? `hey ${firstName}!` : "hey!";
  return `${greeting} I'm autOScan, your grading helper.\n\nDrop a submissions zip in the box below and tell me the assignment name (something like S0 or S2). I'll compile everything, run the tests, and flag any banned functions for you.\n\nOnce that's done, I can also check submissions for similarity if you want to spot copies, or run an AI detection pass on the code. Just ask.`;
}

export function ChatMessages({
  isModelBusy = false,
  messages,
  onAssistantElapsedSettled,
  onSelectStudent,
  selectedStudentId,
  userName,
}: ChatMessagesProps) {
  const lastAssistantMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role === "assistant") {
        return message.id;
      }
    }
    return null;
  }, [messages]);

  const lastMessageRole = messages[messages.length - 1]?.role;
  const responseInFlight = lastMessageRole === "assistant";

  const welcomeBubble = (
    <Message className="max-w-full" from="assistant" key="welcome">
      <MessageContent className="w-full max-w-full gap-3">
        <MessageResponse>{buildWelcomeText(userName)}</MessageResponse>
      </MessageContent>
    </Message>
  );

  const messageNodes = messages.map((message) => {
    const isAssistant = message.role === "assistant";
    const showDitto =
      isAssistant &&
      message.id === lastAssistantMessageId &&
      responseInFlight;
    const thoughtSteps = isAssistant ? extractThoughtSteps(message) : [];
    const dittoActive = showDitto && isModelBusy;

    return (
      <Message
        className={isAssistant ? "max-w-full" : undefined}
        from={message.role}
        key={message.id}
      >
        <MessageContent
          className={cn("gap-3", isAssistant && "w-full max-w-full")}
        >
          {isAssistant ? (
            <AssistantThoughtTrail steps={thoughtSteps} />
          ) : null}
          {message.parts.map((part, index) => {
            const key = `${message.id}-${index}`;

            if (part.type === "text") {
              return <MessageResponse key={key}>{part.text}</MessageResponse>;
            }

            if (part.type === "file") {
              return <FileChip key={key} part={part} />;
            }

            if (
              isToolUIPart(part) &&
              toolNameOf(part) === "grade_submissions" &&
              part.state === "output-available"
            ) {
              return (
                <GradingResultsTable
                  key={key}
                  onSelectStudent={onSelectStudent}
                  part={part}
                  selectedStudentId={selectedStudentId}
                />
              );
            }

            return null;
          })}
          {showDitto ? (
            <DittoThinking
              active={dittoActive}
              initialElapsedMs={messageElapsedMs(message)}
              onElapsedSettled={(elapsedMs) =>
                onAssistantElapsedSettled?.(message.id, elapsedMs)
              }
            />
          ) : null}
        </MessageContent>
      </Message>
    );
  });

  return (
    <>
      {welcomeBubble}
      {messageNodes}
    </>
  );
}
