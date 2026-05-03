import { formatStudentName } from "@/components/chat/shared/display";
import type { StudentResultRow } from "@/components/chat/shared/types";
import type { AIDetectionSubmission } from "@/components/chat/shared/tool-reports";
import { DetailDrawer } from "../DetailDrawer";
import { DetailHeader } from "../DetailHeader";
import { SourceCodePanel } from "../SourceCodePanel";

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--chat-text-muted)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] font-[510] text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}

export function AIDetectionDetail({
  onClose,
  onCloseStart,
  submission,
  student,
}: {
  onClose: () => void;
  onCloseStart?: () => void;
  submission: AIDetectionSubmission;
  student: StudentResultRow | null;
}) {
  return (
    <DetailDrawer onClose={onClose} onCloseStart={onCloseStart}>
      {(close) => (
        <>
          <DetailHeader onBack={close}>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-[13px] font-[510] text-[var(--foreground)]">
                {formatStudentName(submission.id)}
              </span>
              <span className="shrink-0 rounded bg-[var(--linear-ghost)] px-2 py-0.5 font-mono text-[11px] text-[var(--chat-text-secondary)]">
                {submission.parse_error
                  ? "Parse error"
                  : `${Math.round(submission.best_score * 100)}%`}
              </span>
              {submission.flagged ? (
                <span className="shrink-0 rounded bg-[var(--linear-danger)]/12 px-2 py-0.5 text-[11px] font-[510] text-[var(--linear-danger)]">
                  Flagged
                </span>
              ) : null}
            </div>
          </DetailHeader>
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_22rem]">
            <SourceCodePanel
              className="border-r border-[var(--linear-border-subtle)]"
              code={student?.sourceText}
            />
            <aside className="min-h-0 overflow-y-auto px-4 py-3">
              <div className="space-y-2">
                <Stat
                  label="AI score"
                  value={
                    submission.parse_error
                      ? "Unavailable"
                      : `${Math.round(submission.best_score * 100)}%`
                  }
                />
                <Stat label="Flagged" value={submission.flagged ? "Yes" : "No"} />
                <Stat
                  label="Matches"
                  value={String(submission.match_count ?? 0)}
                />
                {submission.parse_error ? (
                  <div className="rounded-md border border-[var(--linear-danger)]/25 bg-[var(--linear-danger)]/10 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--linear-danger)]">
                      Parse error
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-[var(--foreground)]">
                      {submission.parse_error}
                    </p>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </>
      )}
    </DetailDrawer>
  );
}
