"use client";

import { RefreshCwIcon } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { formatStudentName, gradeTone, statusTone } from "./display";
import type { GradingRunResponse, StudentInspectorRow } from "./types";

export type InspectorPanelProps = {
  data: GradingRunResponse | null;
  error: string | null;
  loading: boolean;
  selectedStudentId: string | null;
};

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--chat-text-muted)]">
      {children}
    </p>
  );
}

export function InspectorPanel({
  data,
  error,
  loading,
  selectedStudentId,
}: InspectorPanelProps) {
  const students = useMemo(() => data?.students ?? [], [data?.students]);
  const selectedStudent = useMemo(() => {
    if (students.length === 0) {
      return null;
    }
    return (
      students.find((student) => student.studentId === selectedStudentId) ??
      students[0]
    );
  }, [students, selectedStudentId]);

  const hasStudents = students.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error ? (
        <div className="mx-6 mt-5 rounded-md border border-[var(--linear-danger)]/35 bg-[var(--linear-danger)]/10 px-3 py-2 text-sm text-[var(--linear-danger)]">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--chat-text-muted)]">
          <RefreshCwIcon className="mr-2 size-4 animate-spin" />
          Loading...
        </div>
      ) : !hasStudents ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[13px] text-[var(--chat-text-muted)]">
          No grading results yet
        </div>
      ) : selectedStudent ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            <section>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <SectionLabel>Student</SectionLabel>
                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                    <p className="truncate font-mono text-[28px] font-[510] tracking-[-0.04em] text-[var(--foreground)]">
                      {formatStudentName(selectedStudent.studentId)}
                    </p>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-[510]",
                        statusTone(selectedStudent.status),
                      )}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {selectedStudent.status ?? "unknown"}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <SectionLabel>Grade</SectionLabel>
                  <p
                    className={cn(
                      "mt-1 font-heading text-[46px] font-[510] leading-none tracking-[-0.06em] tabular-nums",
                      gradeTone(selectedStudent.grade),
                    )}
                  >
                    {gradeLabel(selectedStudent)}
                  </p>
                </div>
              </div>
            </section>

            <section className="-mx-6 grid grid-cols-3 divide-x divide-[var(--linear-border-subtle)] border-y border-[var(--linear-border-subtle)] px-6 py-5">
              {metricsFor(selectedStudent).map((metric, index) => (
                <div className={cn(index > 0 && "pl-4", index < 2 && "pr-4")} key={metric.label}>
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

            {selectedStudent.notes ? (
              <section className="-mx-6 border-b border-[var(--linear-border-subtle)] px-6 pb-5">
                <SectionLabel>Notes</SectionLabel>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--chat-text-secondary)]">
                  {selectedStudent.notes}
                </p>
              </section>
            ) : null}

            {selectedStudent.sourceText ? (
              <details className="group -mx-6 border-t border-[var(--linear-border-subtle)] px-6 pt-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[12px] font-[510] text-[var(--chat-text-secondary)] hover:text-[var(--foreground)]">
                  <SectionLabel>Submitted source</SectionLabel>
                  <span className="text-[11px] text-[var(--chat-text-muted)] transition group-open:rotate-180">
                    v
                  </span>
                </summary>
                <pre className="mt-3 max-h-80 overflow-auto rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-panel)] p-3 font-mono text-[12px] leading-[1.55] text-[var(--foreground)]">
                  {selectedStudent.sourceText}
                </pre>
              </details>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
