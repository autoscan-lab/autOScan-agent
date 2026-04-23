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
import { BrainIcon, FileArchiveIcon, PlayIcon, WrenchIcon } from "lucide-react";
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
  ConversationEmptyState,
} from "@/components/chat/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/chat/ai-elements/message";
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

  const label = anyActive
    ? "Thinking..."
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
            <ToolStepItem key={`${message.id}-step-${index}`} part={step.part} />
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

export function ChatMessages({ messages }: { messages: UIMessage[] }) {
  if (messages.length === 0) {
    return (
      <ConversationEmptyState className="gap-3 pt-32">
        <h2 className="font-heading text-[32px] font-[510] leading-[1.1] tracking-[-0.025em] text-[var(--foreground)]">
          What are we grading today?
        </h2>
        <p className="text-[14px] leading-relaxed text-[var(--chat-text-muted)]">
          Attach submissions and ask for a grade
        </p>
      </ConversationEmptyState>
    );
  }

  return messages.map((message) => {
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
          className={cn("gap-3", isAssistant && "w-full max-w-full")}
        >
          {hasThoughts ? <AssistantThoughtTrail message={message} /> : null}
          {message.parts.map((part, index) => {
            const key = `${message.id}-${index}`;

            if (part.type === "text") {
              return <MessageResponse key={key}>{part.text}</MessageResponse>;
            }

            if (part.type === "file") {
              return <FileChip key={key} part={part} />;
            }

            return null;
          })}
        </MessageContent>
      </Message>
    );
  });
}
