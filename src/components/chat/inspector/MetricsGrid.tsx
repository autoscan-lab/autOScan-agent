import type { StudentInspectorRow } from "@/components/chat/support/types";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./shared";

type Metric = {
  label: string;
  tone: string;
  value: string;
};

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
