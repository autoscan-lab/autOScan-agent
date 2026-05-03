import { formatStudentName } from "@/components/chat/shared/display";
import type { StudentResultRow } from "@/components/chat/shared/types";
import type { SimilarityPair } from "@/components/chat/shared/tool-reports";
import { DetailDrawer } from "../DetailDrawer";
import { DetailHeader } from "../DetailHeader";
import { rangesForCodeSpans, SourceCodePanel } from "../SourceCodePanel";

function sourceFor(studentId: string, students: StudentResultRow[]) {
  return students.find((student) => student.studentId === studentId) ?? null;
}

function SourceComparePanel({
  label,
  ranges,
  student,
}: {
  label: string;
  ranges: ReturnType<typeof rangesForCodeSpans>;
  student: StudentResultRow | null;
}) {
  return (
    <section className="flex min-h-0 flex-col border-r border-[var(--linear-border-subtle)] last:border-r-0">
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-[var(--linear-border-subtle)] px-3">
        <span className="truncate text-[12px] font-[510] text-[var(--foreground)]">
          {label}
        </span>
        {ranges.length > 0 ? (
          <span className="shrink-0 rounded bg-[var(--linear-accent)]/12 px-2 py-0.5 text-[11px] font-[510] text-[var(--linear-accent-hover)]">
            {ranges.length} matched {ranges.length === 1 ? "span" : "spans"}
          </span>
        ) : null}
      </div>
      <SourceCodePanel
        className="flex-1"
        code={student?.sourceText}
        highlightedLineRanges={ranges}
      />
    </section>
  );
}

export function SimilarityDetail({
  onClose,
  onCloseStart,
  pair,
  students,
}: {
  onClose: () => void;
  onCloseStart?: () => void;
  pair: SimilarityPair;
  students: StudentResultRow[];
}) {
  const studentA = sourceFor(pair.a, students);
  const studentB = sourceFor(pair.b, students);
  const rangesA = rangesForCodeSpans(pair.spansA, studentA?.sourceText);
  const rangesB = rangesForCodeSpans(pair.spansB, studentB?.sourceText);

  return (
    <DetailDrawer onClose={onClose} onCloseStart={onCloseStart}>
      {(close) => (
        <>
          <DetailHeader onBack={close}>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-[13px] font-[510] text-[var(--foreground)]">
                {formatStudentName(pair.a)} / {formatStudentName(pair.b)}
              </span>
              <span className="shrink-0 rounded bg-[var(--linear-ghost)] px-2 py-0.5 font-mono text-[11px] text-[var(--chat-text-secondary)]">
                {Math.round(pair.similarity_percent)}%
              </span>
              {pair.flagged ? (
                <span className="shrink-0 rounded bg-[var(--linear-danger)]/12 px-2 py-0.5 text-[11px] font-[510] text-[var(--linear-danger)]">
                  Flagged
                </span>
              ) : null}
            </div>
          </DetailHeader>
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
            <SourceComparePanel
              label={formatStudentName(pair.a)}
              ranges={rangesA}
              student={studentA}
            />
            <SourceComparePanel
              label={formatStudentName(pair.b)}
              ranges={rangesB}
              student={studentB}
            />
          </div>
        </>
      )}
    </DetailDrawer>
  );
}
