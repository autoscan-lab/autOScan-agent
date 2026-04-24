import { Code2Icon } from "lucide-react";

import type { StudentInspectorRow } from "@/components/chat/support/types";
import { EmptyDetail, SectionLabel } from "./shared";

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
