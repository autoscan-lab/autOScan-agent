"use client";

import { RefreshCwIcon } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { formatStudentName, gradeTone, statusTone } from "./display";
import type { GradingRunResponse } from "./types";

export type InspectorPanelProps = {
  data: GradingRunResponse | null;
  error: string | null;
  loading: boolean;
  selectedStudentId: string | null;
  setSelectedStudentId: (id: string | null) => void;
};

export function InspectorPanel({
  data,
  error,
  loading,
  selectedStudentId,
  setSelectedStudentId,
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
          Loading...
        </div>
      ) : !hasStudents ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[13px] text-[var(--chat-text-muted)]">
          No grading results yet
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[13rem,1fr]">
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
                      {student.status ?? "-"}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[10px] font-[510] leading-none tabular-nums",
                        gradeTone(student.grade),
                      )}
                    >
                      {student.grade === null ? "-" : student.grade}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="min-h-0 overflow-y-auto p-4">
            {selectedStudent ? (
              <div className="space-y-4">
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
                      {selectedStudent.grade === null ? "-" : selectedStudent.grade}
                    </p>
                  </div>
                </div>

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

                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: "Compile",
                      value:
                        selectedStudent.compileOk === null
                          ? "-"
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
                      value: selectedStudent.testsPassed ?? "-",
                      tone: "text-[var(--foreground)]",
                    },
                    {
                      label: "Banned",
                      value:
                        selectedStudent.bannedCount === null
                          ? "-"
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

                {selectedStudent.sourceText ? (
                  <details className="group rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[12px] font-[510] text-[var(--chat-text-secondary)] hover:text-[var(--foreground)]">
                      <span className="font-mono uppercase tracking-[0.04em] text-[var(--chat-text-muted)]">
                        Submitted source
                      </span>
                      <span className="text-[11px] text-[var(--chat-text-muted)] transition group-open:rotate-180">
                        v
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
