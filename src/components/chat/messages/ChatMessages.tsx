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

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringOf(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function numberOf(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function numberFromKeys(
  source: Record<string, unknown> | undefined,
  keys: string[],
) {
  if (!source) {
    return undefined;
  }
  for (const key of keys) {
    const value = numberOf(source[key]);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function lengthFromKeys(
  source: Record<string, unknown> | undefined,
  keys: string[],
) {
  if (!source) {
    return undefined;
  }
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      return value.length;
    }
  }
  return undefined;
}

function chips(...values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value));
}

function summarizeStudentStates(studentsValue: unknown) {
  if (!Array.isArray(studentsValue)) {
    return undefined;
  }

  let clean = 0;
  let banned = 0;
  let failed = 0;

  for (const entry of studentsValue) {
    const row = recordOf(entry);
    if (!row) {
      continue;
    }

    const status = stringOf(row.status) ?? "";
    const compileOk =
      typeof row.compileOk === "boolean" ? row.compileOk : undefined;
    const bannedCount = numberOf(row.bannedCount) ?? 0;

    if (compileOk === false || isFailedStatus(status)) {
      failed += 1;
      continue;
    }
    if (bannedCount > 0 || status.toLowerCase().includes("banned")) {
      banned += 1;
      continue;
    }
    clean += 1;
  }

  return { banned, clean, failed, total: studentsValue.length };
}

function similarityMetrics(value: unknown) {
  if (Array.isArray(value)) {
    return { pairCount: value.length, suspiciousCount: undefined as number | undefined };
  }

  const report = recordOf(value);
  if (!report) {
    return { pairCount: undefined, suspiciousCount: undefined };
  }

  const pairCount =
    numberFromKeys(report, [
      "pairCount",
      "pairsCompared",
      "totalPairs",
      "comparisonCount",
    ]) ??
    lengthFromKeys(report, ["pairs", "comparisons", "results", "entries"]);

  const suspiciousCount =
    numberFromKeys(report, ["suspiciousPairs", "matchCount", "flaggedCount"]) ??
    lengthFromKeys(report, ["suspicious", "matches", "flagged", "alerts"]);

  return { pairCount, suspiciousCount };
}

function aiDetectionMetrics(value: unknown) {
  if (Array.isArray(value)) {
    return { flaggedCount: undefined as number | undefined, total: value.length };
  }

  const report = recordOf(value);
  if (!report) {
    return { flaggedCount: undefined, total: undefined };
  }

  const flaggedCount =
    numberFromKeys(report, [
      "flaggedCount",
      "likelyAiCount",
      "suspectedCount",
      "highRiskCount",
    ]) ??
    lengthFromKeys(report, ["flagged", "suspected", "likely_ai", "highRisk"]);

  const total =
    numberFromKeys(report, ["total", "studentCount", "checkedCount", "analyzed"]) ??
    lengthFromKeys(report, ["students", "results", "entries"]);

  return { flaggedCount, total };
}

function summarizeTool(toolName: string, part: ToolPart): ToolSummary {
  const input = recordOf("input" in part ? part.input : undefined);
  const output = recordOf("output" in part ? part.output : undefined);
  const isRunning =
    part.state === "input-streaming" || part.state === "input-available";
  const outputMessage = stringOf(output?.message);

  if (outputMessage && !isRunning) {
    return {
      chips: [],
      description: outputMessage,
      label: `Completed ${toolName}`,
    };
  }

  switch (toolName) {
    case "check_similarity": {
      const metrics = similarityMetrics(output?.similarity);
      if (isRunning) {
        return {
          chips: [],
          label: "Running check_similarity...",
        };
      }
      return {
        chips: chips(
          metrics.pairCount !== undefined ? `${metrics.pairCount} pairs` : undefined,
          metrics.suspiciousCount !== undefined
            ? `${metrics.suspiciousCount} flagged`
            : undefined,
        ),
        description:
          metrics.suspiciousCount !== undefined
            ? metrics.suspiciousCount > 0
              ? `Flagged ${metrics.suspiciousCount} likely copy pair${metrics.suspiciousCount === 1 ? "" : "s"}.`
              : "No likely copy pairs flagged."
            : metrics.pairCount !== undefined
              ? `Compared ${metrics.pairCount} pair${metrics.pairCount === 1 ? "" : "s"}.`
              : undefined,
        label: "Completed check_similarity",
      };
    }

    case "check_ai_detection": {
      const metrics = aiDetectionMetrics(output?.aiDetection);
      if (isRunning) {
        return {
          chips: [],
          label: "Running check_ai_detection...",
        };
      }
      return {
        chips: chips(
          metrics.total !== undefined ? `${metrics.total} checked` : undefined,
          metrics.flaggedCount !== undefined
            ? `${metrics.flaggedCount} flagged`
            : undefined,
        ),
        description:
          metrics.flaggedCount !== undefined
            ? metrics.flaggedCount > 0
              ? `Flagged ${metrics.flaggedCount} submission${metrics.flaggedCount === 1 ? "" : "s"} as likely AI-generated.`
              : "No likely AI-generated submissions flagged."
            : undefined,
        label: "Completed check_ai_detection",
      };
    }

    case "grade_submissions": {
      const assignment =
        stringOf(input?.assignment_name) ?? stringOf(output?.assignmentName);
      const studentStates = summarizeStudentStates(output?.students);
      const count = numberOf(output?.studentCount) ?? studentStates?.total;
      const assignmentChip = assignment ? `assignment ${assignment}` : undefined;

      if (isRunning) {
        return {
          chips: chips(assignmentChip),
          description:
            "Setting up assignment, compiling submissions, running tests, and scanning banned functions.",
          label: assignment
            ? `Running grade_submissions(${assignment})...`
            : "Running grade_submissions...",
        };
      }

      return {
        chips: chips(
          assignmentChip,
          studentStates ? `${studentStates.clean} clean` : undefined,
          studentStates ? `${studentStates.banned} banned` : undefined,
          studentStates ? `${studentStates.failed} failed` : undefined,
        ),
        description:
          count !== undefined
            ? `Processed ${count} submission${count === 1 ? "" : "s"}.`
            : undefined,
        label: assignment
          ? `Completed grade_submissions(${assignment})`
          : "Completed grade_submissions",
      };
    }

    default: {
      return {
        chips: [],
        description: outputMessage,
        label: isRunning
          ? `Running ${prettyToolTitle(toolName)}...`
          : `Completed ${prettyToolTitle(toolName)}`,
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
      label={isActive ? "Calling tools..." : "Tool reasoning"}
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
    return null;
  }

  return (
    <ChainOfThought
      className="w-full space-y-3"
      onOpenChange={setOpen}
      open={open}
    >
      <ChainOfThoughtHeader className="text-[var(--chat-text-muted)] hover:text-[var(--foreground)]">
        Tool activity
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
  const lastAssistantMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role === "assistant") {
        return message.id;
      }
    }
    return null;
  }, [messages]);

  const welcomeBubble = (
    <Message className="max-w-full" from="assistant" key="welcome">
      <MessageContent className="w-full max-w-full gap-3">
        <MessageResponse>{buildWelcomeText(userName)}</MessageResponse>
      </MessageContent>
    </Message>
  );

  const messageNodes = messages.map((message) => {
    const isAssistant = message.role === "assistant";
    const showDitto = isAssistant && message.id === lastAssistantMessageId;
    const dittoActive =
      showDitto && extractThoughtSteps(message).some(stepActivity);

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
          {showDitto ? <DittoThinking active={dittoActive} /> : null}
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
