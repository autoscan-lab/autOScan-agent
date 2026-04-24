import { FileWarningIcon } from "lucide-react";

import type { StudentInspectorRow } from "@/components/chat/support/types";
import { EmptyDetail, SectionLabel } from "./shared";

function locationLabel(hit: StudentInspectorRow["bannedHits"][number]) {
  const file = hit.file ?? "unknown file";
  const line = hit.line === null ? "" : `:${hit.line}`;
  const column = hit.column === null ? "" : `:${hit.column}`;
  return `${file}${line}${column}`;
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
