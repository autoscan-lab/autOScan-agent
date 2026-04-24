import { CheckCircle2Icon, TerminalIcon } from "lucide-react";

import type { StudentInspectorRow } from "@/components/chat/support/types";
import { SectionLabel } from "./shared";

function formatDuration(ms: number | null) {
  if (ms === null) {
    return "not reported";
  }
  if (ms < 1000) {
    return `${ms} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
}

function compileTimeoutLabel(value: boolean | null) {
  if (value === null) {
    return "not reported";
  }
  return value ? "yes" : "no";
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
