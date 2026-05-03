"use client";

import type { StudentResultRow } from "@/components/chat/shared/types";

function locationLabel(hit: StudentResultRow["bannedHits"][number]) {
  const file = hit.file ?? "unknown file";
  const line = hit.line === null ? "" : `:${hit.line}`;
  const column = hit.column === null ? "" : `:${hit.column}`;
  return `${file}${line}${column}`;
}

export function CompileSection({ student }: { student: StudentResultRow }) {
  if (!student.compilerError) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-[12px] text-[var(--chat-text-secondary)]">
          No compiler errors were reported.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto px-4 py-3">
      <pre className="overflow-auto rounded-md border border-[var(--linear-danger)]/25 bg-[var(--linear-danger)]/10 p-2.5 font-mono text-[11.5px] leading-relaxed text-[var(--foreground)]">
        {student.compilerError}
      </pre>
    </div>
  );
}

export function BannedSection({
  onRevealLine,
  student,
}: {
  onRevealLine: (line: number) => void;
  student: StudentResultRow;
}) {
  if (student.bannedHits.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-[12px] text-[var(--chat-text-secondary)]">
          No banned functions were reported.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      <div className="space-y-1.5">
        {student.bannedHits.map((hit, index) => (
          <button
            className="flex w-full items-start justify-between gap-3 rounded-md border border-[var(--linear-border-subtle)] bg-transparent px-2.5 py-2 text-left transition-colors hover:border-orange-400/25 hover:bg-orange-400/8"
            key={`${hit.functionName}-${hit.file}-${hit.line}-${index}`}
            onClick={() => {
              if (hit.line !== null) onRevealLine(hit.line);
            }}
            type="button"
          >
            <span className="min-w-0">
              <span className="block truncate font-mono text-[12px] text-[var(--foreground)]">
                {hit.functionName}
              </span>
              {hit.snippet ? (
                <span className="mt-1 block truncate font-mono text-[11px] text-[var(--chat-text-muted)]">
                  {hit.snippet}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 font-mono text-[10.5px] text-orange-300">
              {locationLabel(hit)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
