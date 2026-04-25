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
  PlayIcon,
  ScanSearchIcon,
  WrenchIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
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

type ToolSummary = {
  label: string;
  description?: string;
  chips: string[];
};

type ChatMessagesProps = {
  messages: UIMessage[];
  onSelectStudent?: (studentId: string) => void;
  selectedStudentId?: string | null;
  userName?: string | null;
};

type GradingResultRow = {
  bannedCount: number | null;
  compileOk: boolean | null;
  grade: string;
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
  grade_submissions: PlayIcon,
};

function iconForTool(toolName: string): LucideIcon {
  return toolIconMap[toolName] ?? WrenchIcon;
}

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
    case "check_similarity": {
      if (isRunning) {
        return { chips: [], label: "Checking similarity..." };
      }
      return { chips: [], label: "Checked similarity" };
    }

    case "check_ai_detection": {
      if (isRunning) {
        return { chips: [], label: "Running AI detection..." };
      }
      return { chips: [], label: "Ran AI detection" };
    }

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
            ? `Grading ${assignment}...`
            : "Grading submissions...",
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
          ? `${prettyToolTitle(toolName)}...`
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
      label={isActive ? "Thinking..." : "Reasoning"}
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

  return (
    <ChainOfThoughtStep
      description={
        isError ? (errorText ?? "Tool failed.") : summary.description
      }
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
      status={isRunning ? "active" : "complete"}
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
    return (
      <span className="flex items-center gap-2 text-[var(--chat-text-muted)]">
        <DittoThinking active={false} />
      </span>
    );
  }

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
        <span className="flex-1 text-left">
          <DittoThinking active={anyActive} />
        </span>
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

function rowStatusLabel(row: GradingResultRow) {
  const state = rowState(row);
  if (state === "failed") {
    return "failed";
  }
  if (state === "banned") {
    return "banned";
  }
  return "clean";
}

function rowStatusTone(row: GradingResultRow) {
  const state = rowState(row);
  if (state === "failed") {
    return "text-[var(--linear-danger)]";
  }
  if (state === "banned") {
    return "text-orange-300";
  }
  return "text-[var(--linear-success)]";
}

function rowGradeLabel(row: GradingResultRow) {
  const state = rowState(row);
  if (state === "failed" || state === "banned") {
    return "2";
  }
  return "check later";
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
    return [
      {
        bannedCount:
          typeof row.bannedCount === "number" ? row.bannedCount : null,
        compileOk: typeof row.compileOk === "boolean" ? row.compileOk : null,
        grade: rowGradeLabel({
          bannedCount:
            typeof row.bannedCount === "number" ? row.bannedCount : null,
          compileOk: typeof row.compileOk === "boolean" ? row.compileOk : null,
          grade: "",
          status: typeof row.status === "string" ? row.status : "",
          studentId,
        }),
        status: typeof row.status === "string" ? row.status : "-",
        studentId,
      },
    ];
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
    <div className="my-4 overflow-x-auto rounded-xl border border-border bg-card/40">
      <div className="min-w-full">
        <div
          className="grid border-b border-border bg-muted/70 text-sm"
          style={{ gridTemplateColumns: gradingColumnTemplate }}
        >
          {gradingHeaders.map((header) => (
            <div
              className="px-4 py-2.5 text-left font-semibold text-foreground"
              key={header}
            >
              {header}
            </div>
          ))}
        </div>

        <div>
          {rows.map((row) => {
            const active = row.studentId === selectedStudentId;
            return (
              <button
                aria-pressed={active}
                className={cn(
                  "grid w-full min-w-full border-b border-border text-left text-sm transition-colors last:border-b-0 hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--linear-accent)]",
                  active && "bg-[var(--linear-accent)]/10",
                )}
                key={row.studentId}
                onClick={() => onSelectStudent?.(row.studentId)}
                style={{ gridTemplateColumns: gradingColumnTemplate }}
                type="button"
              >
                <span className="min-w-0 px-4 py-2.5 align-top text-foreground">
                  {formatStudentName(row.studentId)}
                </span>
                <span
                  className={cn(
                    "min-w-0 px-4 py-2.5 align-top font-[510]",
                    rowStatusTone(row),
                  )}
                >
                  {rowStatusLabel(row)}
                </span>
                <span className="min-w-0 px-4 py-2.5 align-top text-[var(--chat-text-secondary)]">
                  {row.grade}
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
  messages,
  onSelectStudent,
  selectedStudentId,
  userName,
}: ChatMessagesProps) {
  const welcomeBubble = (
    <Message className="max-w-full" from="assistant" key="welcome">
      <MessageContent className="w-full max-w-full gap-3">
        <MessageResponse>{buildWelcomeText(userName)}</MessageResponse>
      </MessageContent>
    </Message>
  );

  const messageNodes = messages.map((message) => {
    const isAssistant = message.role === "assistant";

    return (
      <Message
        className={isAssistant ? "max-w-full" : undefined}
        from={message.role}
        key={message.id}
      >
        <MessageContent
          className={cn("gap-3", isAssistant && "w-full max-w-full")}
        >
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
          {isAssistant ? <AssistantThoughtTrail message={message} /> : null}
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
