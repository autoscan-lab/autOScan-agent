import { formatStudentName } from "@/components/chat/shared/display";
import type { StudentResultRow } from "@/components/chat/shared/types";
import type { AIDetectionSubmission } from "@/components/chat/shared/tool-reports";
import { DetailDrawer } from "../DetailDrawer";
import { DetailHeader } from "../DetailHeader";
import { rangesForCodeSpans, SourceCodePanel } from "../SourceCodePanel";

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
  const ranges = rangesForCodeSpans(submission.spans, student?.sourceText);

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
              {ranges.length > 0 ? (
                <span className="shrink-0 rounded bg-[var(--linear-accent)]/12 px-2 py-0.5 text-[11px] font-[510] text-[var(--linear-accent-hover)]">
                  {ranges.length} matched {ranges.length === 1 ? "span" : "spans"}
                </span>
              ) : null}
            </div>
          </DetailHeader>
          <SourceCodePanel
            className="min-h-0 flex-1"
            code={student?.sourceText}
            highlightedLineRanges={ranges}
          />
        </>
      )}
    </DetailDrawer>
  );
}
