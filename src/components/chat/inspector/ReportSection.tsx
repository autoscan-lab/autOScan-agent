"use client";

import { ArrowLeftIcon, ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";

import type {
  StudentInspectorRow,
  ToolReport,
} from "@/components/chat/support/types";
import { cn } from "@/lib/utils";

type ReportKind = "similarity" | "aiDetection";

type MatchSpan = {
  end_col?: number;
  end_line: number;
  snippet?: string;
  start_col?: number;
  start_line: number;
};

type SimilarityMatch = {
  hash?: string;
  spans_a?: MatchSpan[];
  spans_b?: MatchSpan[];
};

type SimilarityPair = {
  a: string;
  b: string;
  flagged: boolean;
  matches?: SimilarityMatch[];
  similarity_percent: number;
};

type SimilarityReport = {
  pairs: SimilarityPair[];
  source_file: string;
};

type AIDetectionMatch = {
  category?: string;
  entry_id?: string;
  flagged?: boolean;
  jaccard?: number;
  spans?: MatchSpan[];
  title?: string;
};

type AIDetectionSubmission = {
  best_score: number;
  flagged: boolean;
  id: string;
  match_count?: number;
  matches?: AIDetectionMatch[];
  parse_error?: string;
};

type AIDetectionReport = {
  dictionary_entry_count: number;
  dictionary_usable: number;
  source_file: string;
  submissions: AIDetectionSubmission[];
};

type LineHighlight = {
  className: string;
};

const similarityHighlightClass =
  "border-l-2 border-amber-300/80";
const aiHighlightClass =
  "border-l-2 border-[var(--linear-danger)]/80";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isMatchSpan(value: unknown): value is MatchSpan {
  if (!isRecord(value)) {
    return false;
  }
  return isNumber(value.start_line) && isNumber(value.end_line);
}

function spansOf(value: unknown): MatchSpan[] | undefined {
  return Array.isArray(value) ? value.filter(isMatchSpan) : undefined;
}

function similarityMatchesOf(value: unknown): SimilarityMatch[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.flatMap((entry): SimilarityMatch[] => {
    if (!isRecord(entry)) {
      return [];
    }
    return [
      {
        hash: typeof entry.hash === "string" ? entry.hash : undefined,
        spans_a: spansOf(entry.spans_a),
        spans_b: spansOf(entry.spans_b),
      },
    ];
  });
}

function aiDetectionMatchesOf(value: unknown): AIDetectionMatch[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.flatMap((entry): AIDetectionMatch[] => {
    if (!isRecord(entry)) {
      return [];
    }
    return [
      {
        category: typeof entry.category === "string" ? entry.category : undefined,
        entry_id: typeof entry.entry_id === "string" ? entry.entry_id : undefined,
        flagged: typeof entry.flagged === "boolean" ? entry.flagged : undefined,
        jaccard: isNumber(entry.jaccard) ? entry.jaccard : undefined,
        spans: spansOf(entry.spans),
        title: typeof entry.title === "string" ? entry.title : undefined,
      },
    ];
  });
}

function isSimilarityPair(value: unknown): value is SimilarityPair {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.a === "string" &&
    typeof value.b === "string" &&
    typeof value.flagged === "boolean" &&
    isNumber(value.similarity_percent)
  );
}

function similarityReportOf(payload: unknown): SimilarityReport | null {
  if (!isRecord(payload)) {
    return null;
  }
  if (typeof payload.source_file !== "string" || !Array.isArray(payload.pairs)) {
    return null;
  }
  if (!payload.pairs.every(isSimilarityPair)) {
    return null;
  }

  return {
    pairs: payload.pairs.map((pair) => ({
      ...pair,
      matches: similarityMatchesOf(pair.matches),
    })),
    source_file: payload.source_file,
  };
}

function isAIDetectionSubmission(
  value: unknown,
): value is AIDetectionSubmission {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.flagged === "boolean" &&
    isNumber(value.best_score)
  );
}

function aiDetectionReportOf(payload: unknown): AIDetectionReport | null {
  if (!isRecord(payload)) {
    return null;
  }
  if (
    typeof payload.source_file !== "string" ||
    !isNumber(payload.dictionary_entry_count) ||
    !isNumber(payload.dictionary_usable) ||
    !Array.isArray(payload.submissions)
  ) {
    return null;
  }
  if (!payload.submissions.every(isAIDetectionSubmission)) {
    return null;
  }

  return {
    dictionary_entry_count: payload.dictionary_entry_count,
    dictionary_usable: payload.dictionary_usable,
    source_file: payload.source_file,
    submissions: payload.submissions.map((submission) => ({
      ...submission,
      matches: aiDetectionMatchesOf(submission.matches),
    })),
  };
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function scoreTone(flagged: boolean, score: number) {
  if (flagged) {
    return "text-[var(--linear-danger)]";
  }
  if (score >= 0.5) {
    return "text-orange-300";
  }
  return "text-[var(--chat-text-muted)]";
}

function studentLabel(value: string) {
  const parts = value.split("/").filter(Boolean);
  return parts.at(-1) ?? value;
}

function normalizedId(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function findStudent(value: string, students: StudentInspectorRow[]) {
  const full = normalizedId(value);
  const label = normalizedId(studentLabel(value));

  return (
    students.find((student) => {
      const studentId = normalizedId(student.studentId);
      const path = normalizedId(student.path);
      const pathLabel = normalizedId(student.path ? studentLabel(student.path) : "");
      return (
        full === studentId ||
        label === studentId ||
        full === path ||
        label === pathLabel ||
        (studentId.length > 0 && full.includes(studentId)) ||
        (path.length > 0 && full.includes(path))
      );
    }) ?? null
  );
}

function sourceFor(value: string, students: StudentInspectorRow[]) {
  return findStudent(value, students)?.sourceText ?? null;
}

function addSpanHighlights(
  highlights: Map<number, LineHighlight>,
  spans: MatchSpan[] | undefined,
  highlight: LineHighlight,
) {
  for (const span of spans ?? []) {
    const start = Math.max(1, Math.floor(span.start_line));
    const end = Math.max(start, Math.floor(span.end_line));
    for (let line = start; line <= end; line++) {
      if (!highlights.has(line)) {
        highlights.set(line, highlight);
      }
    }
  }
}

function EmptyReport({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[min(18rem,55vh)] items-center justify-center px-6 text-center text-[13px] text-[var(--chat-text-muted)]">
      {children}
    </div>
  );
}

function DetailHeader({
  onBack,
  title,
}: {
  onBack: () => void;
  title: string;
}) {
  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-[var(--linear-border)] px-3 py-2 pr-36">
      <div className="flex min-w-0 items-center gap-2">
        <button
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] text-[var(--chat-text-secondary)] transition-colors hover:border-[var(--linear-border)] hover:bg-[var(--linear-ghost-hover)] hover:text-[var(--foreground)]"
          onClick={onBack}
          type="button"
        >
          <ArrowLeftIcon className="size-3.5" />
        </button>
        <h3 className="truncate text-[13px] font-[560] text-[var(--foreground)]">
          {title}
        </h3>
      </div>
    </div>
  );
}

function HighlightedSource({
  emptyMessage,
  highlights,
  source,
}: {
  emptyMessage: string;
  highlights: Map<number, LineHighlight>;
  source: string | null;
}) {
  if (!source) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-[var(--chat-text-muted)]">
        {emptyMessage}
      </div>
    );
  }

  const lines = source.split("\n");

  return (
    <pre className="min-h-full overflow-x-auto py-2 font-mono text-[11.5px] leading-[1.55] text-[var(--foreground)]">
      {lines.map((line, index) => {
        const lineNumber = index + 1;
        const highlight = highlights.get(lineNumber);
        return (
          <div
            className={cn(
              "grid min-w-max grid-cols-[3.25rem_1fr] border-l-2 border-transparent px-3",
              highlight?.className,
            )}
            key={lineNumber}
          >
            <span className="select-none pr-4 text-right text-[var(--chat-text-muted)]">
              {lineNumber}
            </span>
            <span className="whitespace-pre">{line || " "}</span>
          </div>
        );
      })}
    </pre>
  );
}

function SourcePane({
  emptyMessage,
  highlights,
  label,
  source,
}: {
  emptyMessage: string;
  highlights: Map<number, LineHighlight>;
  label: string;
  source: string | null;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col border-b border-[var(--linear-border-subtle)] last:border-b-0">
      <div className="flex min-h-9 items-center justify-between gap-3 border-b border-[var(--linear-border-subtle)] px-3 py-1.5">
        <span className="truncate font-mono text-[11px] text-[var(--chat-text-secondary)]">
          {studentLabel(label)}
        </span>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 overflow-auto bg-transparent">
        <HighlightedSource
          emptyMessage={emptyMessage}
          highlights={highlights}
          source={source}
        />
      </div>
    </div>
  );
}

function SimilarityDetail({
  onBack,
  pair,
  students,
}: {
  onBack: () => void;
  pair: SimilarityPair;
  students: StudentInspectorRow[];
}) {
  const sourceA = sourceFor(pair.a, students);
  const sourceB = sourceFor(pair.b, students);
  const { highlightsA, highlightsB, matchCount } = useMemo(() => {
    const nextA = new Map<number, LineHighlight>();
    const nextB = new Map<number, LineHighlight>();
    for (const match of pair.matches ?? []) {
      addSpanHighlights(nextA, match.spans_a, {
        className: similarityHighlightClass,
      });
      addSpanHighlights(nextB, match.spans_b, {
        className: similarityHighlightClass,
      });
    }
    return {
      highlightsA: nextA,
      highlightsB: nextB,
      matchCount: pair.matches?.length ?? 0,
    };
  }, [pair.matches]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DetailHeader
        onBack={onBack}
        title={`${studentLabel(pair.a)} vs ${studentLabel(pair.b)}`}
      />
      {matchCount === 0 ? (
        <p className="border-b border-[var(--linear-border-subtle)] px-3 py-2 text-[12px] text-[var(--chat-text-muted)]">
          No span data was returned for this pair. Re-run similarity on a fresh
          result to store spans.
        </p>
      ) : null}
      <div className="min-h-0 flex-1">
        <div className="flex h-full min-h-0 flex-col">
          <SourcePane
            emptyMessage="Source unavailable for the first submission."
            highlights={highlightsA}
            label={pair.a}
            source={sourceA}
          />
          <SourcePane
            emptyMessage="Source unavailable for the second submission."
            highlights={highlightsB}
            label={pair.b}
            source={sourceB}
          />
        </div>
      </div>
    </div>
  );
}

function AIDetectionDetail({
  onBack,
  students,
  submission,
}: {
  onBack: () => void;
  students: StudentInspectorRow[];
  submission: AIDetectionSubmission;
}) {
  const source = sourceFor(submission.id, students);
  const highlights = useMemo(() => {
    const next = new Map<number, LineHighlight>();
    for (const match of submission.matches ?? []) {
      addSpanHighlights(next, match.spans, {
        className: match.flagged ?? submission.flagged
          ? aiHighlightClass
          : similarityHighlightClass,
      });
    }
    return next;
  }, [submission.flagged, submission.matches]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DetailHeader
        onBack={onBack}
        title={`AI detection · ${studentLabel(submission.id)}`}
      />
      <div className="no-scrollbar min-h-0 flex-1 overflow-auto">
        <HighlightedSource
          emptyMessage="Source unavailable for this submission."
          highlights={highlights}
          source={source}
        />
      </div>
    </div>
  );
}

function SimilarityTable({
  onSelect,
  pairs,
}: {
  onSelect: (pair: SimilarityPair) => void;
  pairs: SimilarityPair[];
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-[var(--linear-border)] font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--chat-text-muted)]">
            <th className="px-4 py-2.5 text-left font-[510]">Student A</th>
            <th className="px-4 py-2.5 text-left font-[510]">Student B</th>
            <th className="px-4 py-2.5 text-right font-[510]">Matches</th>
            <th className="px-4 py-2.5 text-right font-[510]">Similarity</th>
            <th className="px-4 py-2.5 text-right font-[510]">Flagged</th>
            <th className="w-10 px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {pairs.map((pair) => (
            <tr
              className="cursor-pointer border-b border-[var(--linear-border-subtle)] text-[13px] transition-colors last:border-b-0 hover:bg-white/[0.035]"
              key={`${pair.a}-${pair.b}`}
              onClick={() => onSelect(pair)}
            >
              <td className="px-4 py-2.5 font-[560] text-[var(--foreground)]">
                {studentLabel(pair.a)}
              </td>
              <td className="px-4 py-2.5 font-[560] text-[var(--foreground)]">
                {studentLabel(pair.b)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-[var(--chat-text-muted)]">
                {pair.matches?.length ?? 0}
              </td>
              <td
                className={cn(
                  "px-4 py-2.5 text-right font-mono font-[650]",
                  scoreTone(pair.flagged, pair.similarity_percent / 100),
                )}
              >
                {`${Math.round(pair.similarity_percent)}%`}
              </td>
              <td
                className={cn(
                  "px-4 py-2.5 text-right font-[560]",
                  pair.flagged
                    ? "text-[var(--linear-danger)]"
                    : "text-[var(--chat-text-muted)]",
                )}
              >
                {pair.flagged ? "Yes" : "No"}
              </td>
              <td className="px-3 py-2.5 text-right text-[var(--chat-text-muted)]">
                <ChevronRightIcon className="ml-auto size-3.5" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AIDetectionTable({
  onSelect,
  submissions,
}: {
  onSelect: (submission: AIDetectionSubmission) => void;
  submissions: AIDetectionSubmission[];
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-[var(--linear-border)] font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--chat-text-muted)]">
            <th className="px-4 py-2.5 text-left font-[510]">Student</th>
            <th className="px-4 py-2.5 text-right font-[510]">Matches</th>
            <th className="px-4 py-2.5 text-right font-[510]">AI score</th>
            <th className="px-4 py-2.5 text-right font-[510]">Flagged</th>
            <th className="w-10 px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {submissions.map((submission) => (
            <tr
              className="cursor-pointer border-b border-[var(--linear-border-subtle)] text-[13px] transition-colors last:border-b-0 hover:bg-white/[0.035]"
              key={submission.id}
              onClick={() => onSelect(submission)}
            >
              <td className="px-4 py-2.5 font-[560] text-[var(--foreground)]">
                {studentLabel(submission.id)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-[var(--chat-text-muted)]">
                {submission.match_count ?? submission.matches?.length ?? 0}
              </td>
              <td
                className={cn(
                  "px-4 py-2.5 text-right font-mono font-[650]",
                  submission.parse_error
                    ? "text-[var(--linear-danger)]"
                    : scoreTone(submission.flagged, submission.best_score),
                )}
              >
                {submission.parse_error ? "Error" : percent(submission.best_score)}
              </td>
              <td
                className={cn(
                  "px-4 py-2.5 text-right font-[560]",
                  submission.parse_error || submission.flagged
                    ? "text-[var(--linear-danger)]"
                    : "text-[var(--chat-text-muted)]",
                )}
              >
                {submission.parse_error ? "Error" : submission.flagged ? "Yes" : "No"}
              </td>
              <td className="px-3 py-2.5 text-right text-[var(--chat-text-muted)]">
                <ChevronRightIcon className="ml-auto size-3.5" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportSection({
  kind,
  report,
  students,
}: {
  kind: ReportKind;
  report: ToolReport | null;
  students: StudentInspectorRow[];
}) {
  const [selectedSimilarityPair, setSelectedSimilarityPair] =
    useState<SimilarityPair | null>(null);
  const [selectedDetectionSubmission, setSelectedDetectionSubmission] =
    useState<AIDetectionSubmission | null>(null);

  if (!report) {
    return (
      <section className="no-scrollbar h-full min-h-0 overflow-auto pt-10 pb-10">
        <EmptyReport>No report has been returned yet.</EmptyReport>
      </section>
    );
  }

  if (kind === "similarity") {
    const similarity = similarityReportOf(report.payload);
    if (!similarity) {
      return (
        <section className="no-scrollbar h-full min-h-0 overflow-auto pt-10 pb-10">
          <EmptyReport>
            Similarity report was not returned in the expected shape.
          </EmptyReport>
        </section>
      );
    }
    if (selectedSimilarityPair) {
      return (
        <SimilarityDetail
          onBack={() => setSelectedSimilarityPair(null)}
          pair={selectedSimilarityPair}
          students={students}
        />
      );
    }
    return (
      <section className="no-scrollbar h-full min-h-0 overflow-auto pt-10 pb-10">
        {similarity.pairs.length === 0 ? (
          <EmptyReport>
            No submission pairs met the similarity threshold.
          </EmptyReport>
        ) : (
          <SimilarityTable
            onSelect={setSelectedSimilarityPair}
            pairs={similarity.pairs}
          />
        )}
      </section>
    );
  }

  const detection = aiDetectionReportOf(report.payload);
  if (!detection) {
    return (
      <section className="no-scrollbar h-full min-h-0 overflow-auto pt-10 pb-10">
        <EmptyReport>
          AI detection report was not returned in the expected shape.
        </EmptyReport>
      </section>
    );
  }
  if (selectedDetectionSubmission) {
    return (
      <AIDetectionDetail
        onBack={() => setSelectedDetectionSubmission(null)}
        students={students}
        submission={selectedDetectionSubmission}
      />
    );
  }
  return (
    <section className="no-scrollbar h-full min-h-0 overflow-auto pt-10 pb-10">
      {detection.submissions.length === 0 ? (
        <EmptyReport>No students were returned by AI detection.</EmptyReport>
      ) : (
        <AIDetectionTable
          onSelect={setSelectedDetectionSubmission}
          submissions={detection.submissions}
        />
      )}
    </section>
  );
}
