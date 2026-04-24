import {
  CheckCircle2Icon,
  Code2Icon,
  FileWarningIcon,
  ListChecksIcon,
  TerminalIcon,
} from "lucide-react";

import type { StudentInspectorRow } from "@/components/chat/support/types";
import { cn } from "@/lib/utils";
import { formatStudentName, gradeTone, statusTone } from "../support/display";

type Metric = {
  label: string;
  tone: string;
  value: string;
};

function gradeLabel(student: StudentInspectorRow) {
  return student.grade === null ? "-" : String(student.grade);
}

function metricsFor(student: StudentInspectorRow): Metric[] {
  return [
    {
      label: "Compile",
      value:
        student.compileOk === null
          ? "not reported"
          : student.compileOk
            ? "passes"
            : "fails",
      tone:
        student.compileOk === true
          ? "text-[var(--linear-success)]"
          : student.compileOk === false
            ? "text-[var(--linear-danger)]"
            : "text-[var(--chat-text-muted)]",
    },
    {
      label: "Exit",
      value:
        student.exitCode === null ? "not reported" : String(student.exitCode),
      tone:
        student.exitCode === 0 || student.exitCode === null
          ? "text-[var(--foreground)]"
          : "text-[var(--linear-danger)]",
    },
    {
      label: "Tests",
      value: student.testsPassed ?? "not reported",
      tone: "text-[var(--foreground)]",
    },
    {
      label: "Banned",
      value:
        student.bannedCount === null
          ? "not reported"
          : student.bannedCount === 0
            ? "none"
            : String(student.bannedCount),
      tone:
        student.bannedCount && student.bannedCount > 0
          ? "text-[var(--linear-danger)]"
          : "text-[var(--foreground)]",
    },
  ];
}

function formatDuration(ms: number | null) {
  if (ms === null) {
    return "not reported";
  }
  if (ms < 1000) {
    return `${ms} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
}

function locationLabel(hit: StudentInspectorRow["bannedHits"][number]) {
  const file = hit.file ?? "unknown file";
  const line = hit.line === null ? "" : `:${hit.line}`;
  const column = hit.column === null ? "" : `:${hit.column}`;
  return `${file}${line}${column}`;
}

function compileTimeoutLabel(value: boolean | null) {
  if (value === null) {
    return "not reported";
  }
  return value ? "yes" : "no";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--chat-text-muted)]">
      {children}
    </p>
  );
}

function EmptyDetail({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] px-3 py-2 text-[13px] text-[var(--chat-text-muted)]">
      {children}
    </p>
  );
}

export function StudentHeader({ student }: { student: StudentInspectorRow }) {
  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <SectionLabel>Student</SectionLabel>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate font-mono text-[28px] font-[510] tracking-[-0.04em] text-[var(--foreground)]">
              {formatStudentName(student.studentId)}
            </p>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-[510]",
                statusTone(student.status),
              )}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {student.status ?? "unknown"}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <SectionLabel>Grade</SectionLabel>
          <p
            className={cn(
              "mt-1 font-heading text-[46px] font-[510] leading-none tracking-[-0.06em] tabular-nums",
              gradeTone(student.grade),
            )}
          >
            {gradeLabel(student)}
          </p>
        </div>
      </div>
    </section>
  );
}

export function MetricsGrid({ student }: { student: StudentInspectorRow }) {
  return (
    <section className="-mx-6 grid grid-cols-2 divide-x divide-y divide-[var(--linear-border-subtle)] border-y border-[var(--linear-border-subtle)] px-6 py-5 sm:grid-cols-4 sm:divide-y-0">
      {metricsFor(student).map((metric, index) => (
        <div
          className={cn(
            "py-2 sm:py-0",
            index % 2 === 1 && "pl-4",
            index % 2 === 0 && "pr-4",
          )}
          key={metric.label}
        >
          <SectionLabel>{metric.label}</SectionLabel>
          <p
            className={cn(
              "mt-1 truncate text-[15px] font-[510] tabular-nums",
              metric.tone,
            )}
          >
            {metric.value}
          </p>
        </div>
      ))}
    </section>
  );
}

export function CompileSection({ student }: { student: StudentInspectorRow }) {
  return (
    <section className="-mx-6 border-b border-[var(--linear-border-subtle)] px-6 pb-5">
      <SectionLabel>Compile details</SectionLabel>
      <div className="mt-3 grid gap-2 text-[13px] text-[var(--chat-text-secondary)]">
        <div className="flex items-center justify-between gap-3">
          <span>Duration</span>
          <span className="font-mono text-[var(--foreground)]">
            {formatDuration(student.compileTimeMs)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Timed out</span>
          <span className="font-mono text-[var(--foreground)]">
            {compileTimeoutLabel(student.compileTimeout)}
          </span>
        </div>
        {student.path ? (
          <div className="flex items-center justify-between gap-3">
            <span>Submission path</span>
            <span className="truncate font-mono text-[var(--foreground)]">
              {student.path}
            </span>
          </div>
        ) : null}
      </div>

      {student.compilerError ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-[510] text-[var(--linear-danger)]">
            <TerminalIcon className="size-4" />
            Compiler error
          </div>
          <pre className="max-h-64 overflow-auto rounded-md border border-[var(--linear-danger)]/25 bg-[var(--linear-danger)]/10 p-3 font-mono text-[12px] leading-[1.55] text-[var(--foreground)]">
            {student.compilerError}
          </pre>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 text-[13px] text-[var(--chat-text-muted)]">
          <CheckCircle2Icon className="size-4 text-[var(--linear-success)]" />
          No compiler error reported
        </div>
      )}
    </section>
  );
}

export function BannedHitsSection({
  student,
}: {
  student: StudentInspectorRow;
}) {
  return (
    <section className="-mx-6 border-b border-[var(--linear-border-subtle)] px-6 pb-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionLabel>Banned functions</SectionLabel>
        <span className="font-mono text-[11px] text-[var(--chat-text-muted)]">
          {student.bannedHits.length} hit
          {student.bannedHits.length === 1 ? "" : "s"}
        </span>
      </div>

      {student.bannedHits.length > 0 ? (
        <div className="space-y-2">
          {student.bannedHits.map((hit, index) => (
            <div
              className="rounded-md border border-[var(--linear-danger)]/25 bg-[var(--linear-danger)]/10 p-3"
              key={`${hit.functionName}-${hit.file}-${hit.line}-${index}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[13px] font-[510] text-[var(--linear-danger)]">
                    <FileWarningIcon className="size-4 shrink-0" />
                    <span className="truncate font-mono">
                      {hit.functionName}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-[var(--chat-text-muted)]">
                    {locationLabel(hit)}
                  </p>
                </div>
              </div>
              {hit.snippet ? (
                <pre className="mt-3 overflow-auto rounded-sm border border-[var(--linear-border-subtle)] bg-[var(--linear-panel)] px-2 py-1.5 font-mono text-[11.5px] leading-relaxed text-[var(--foreground)]">
                  {hit.snippet}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyDetail>No banned function usage reported.</EmptyDetail>
      )}
    </section>
  );
}

export function NotesSection({ student }: { student: StudentInspectorRow }) {
  if (!student.notes) {
    return null;
  }

  return (
    <section className="-mx-6 border-b border-[var(--linear-border-subtle)] px-6 pb-5">
      <SectionLabel>Notes</SectionLabel>
      <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--chat-text-secondary)]">
        {student.notes}
      </p>
    </section>
  );
}

export function SourceSection({ student }: { student: StudentInspectorRow }) {
  return (
    <section className="-mx-6 border-b border-[var(--linear-border-subtle)] px-6 pb-5">
      <div className="mb-3 flex items-center gap-2">
        <Code2Icon className="size-4 text-[var(--chat-text-muted)]" />
        <SectionLabel>Submitted source</SectionLabel>
      </div>
      {student.sourceText ? (
        <details className="group" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[12px] font-[510] text-[var(--chat-text-secondary)] hover:text-[var(--foreground)]">
            <span>
              {student.sourceFiles.length > 0
                ? `${student.sourceFiles.length} file${student.sourceFiles.length === 1 ? "" : "s"}`
                : "Source"}
            </span>
            <span className="text-[11px] text-[var(--chat-text-muted)] transition group-open:rotate-180">
              v
            </span>
          </summary>
          <pre className="mt-3 max-h-80 overflow-auto rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-panel)] p-3 font-mono text-[12px] leading-[1.55] text-[var(--foreground)]">
            {student.sourceText}
          </pre>
        </details>
      ) : (
        <EmptyDetail>Source unavailable for this run.</EmptyDetail>
      )}
    </section>
  );
}

export function TestsSection({ student }: { student: StudentInspectorRow }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <ListChecksIcon className="size-4 text-[var(--chat-text-muted)]" />
        <SectionLabel>Test details</SectionLabel>
      </div>
      {student.tests?.cases.length ? (
        <div className="space-y-2">
          {student.tests.cases.map((testCase) => (
            <div
              className="flex items-center justify-between gap-3 rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] px-3 py-2 text-[13px]"
              key={`${testCase.index}-${testCase.name}`}
            >
              <span className="min-w-0 truncate text-[var(--foreground)]">
                {testCase.name ?? `Test ${testCase.index ?? ""}`}
              </span>
              <span
                className={cn(
                  "shrink-0 font-mono",
                  testCase.status === "pass"
                    ? "text-[var(--linear-success)]"
                    : "text-[var(--linear-danger)]",
                )}
              >
                {testCase.status ?? "unknown"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyDetail>Detailed test inspection is coming soon.</EmptyDetail>
      )}
    </section>
  );
}
