import type { ToolReport } from "@/components/chat/support/types";
import { cn } from "@/lib/utils";

type ReportKind = "similarity" | "aiDetection";

type SimilarityPair = {
  a: string;
  b: string;
  flagged: boolean;
  matches?: unknown[];
  per_func_similarity: number;
  window_jaccard: number;
  window_matches: number;
};

type SimilarityReport = {
  pairs: SimilarityPair[];
  source_file: string;
};

type AIDetectionSubmission = {
  best_score: number;
  flagged: boolean;
  id: string;
  match_count?: number;
  matches?: unknown[];
  parse_error?: string;
};

type AIDetectionReport = {
  dictionary_entry_count: number;
  dictionary_usable: number;
  source_file: string;
  submissions: AIDetectionSubmission[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSimilarityPair(value: unknown): value is SimilarityPair {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.a === "string" &&
    typeof value.b === "string" &&
    typeof value.flagged === "boolean" &&
    isNumber(value.per_func_similarity) &&
    isNumber(value.window_jaccard) &&
    isNumber(value.window_matches)
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
    pairs: payload.pairs,
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
    submissions: payload.submissions,
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

function EmptyReport({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[min(18rem,55vh)] items-center justify-center px-6 text-center text-[13px] text-[var(--chat-text-muted)]">
      {children}
    </div>
  );
}

function SimilaritySection({ report }: { report: ToolReport }) {
  const similarity = similarityReportOf(report.payload);

  if (!similarity) {
    return <EmptyReport>Similarity report was not returned in the expected shape.</EmptyReport>;
  }

  if (similarity.pairs.length === 0) {
    return <EmptyReport>No similar submissions reported.</EmptyReport>;
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-[var(--linear-border)] font-mono uppercase tracking-[0.08em] text-[10px] text-[var(--chat-text-muted)]">
            <th className="px-4 py-2.5 text-left font-[510]">Student A</th>
            <th className="px-4 py-2.5 text-left font-[510]">Student B</th>
            <th className="px-4 py-2.5 text-right font-[510]">Similarity</th>
            <th className="px-4 py-2.5 text-right font-[510]">Flagged</th>
          </tr>
        </thead>
        <tbody>
          {similarity.pairs.map((pair) => (
            <tr
              className="border-b border-[var(--linear-border-subtle)] text-[13px] last:border-b-0"
              key={`${pair.a}-${pair.b}`}
            >
              <td className="px-4 py-2.5 font-[560] text-[var(--foreground)]">
                {studentLabel(pair.a)}
              </td>
              <td className="px-4 py-2.5 font-[560] text-[var(--foreground)]">
                {studentLabel(pair.b)}
              </td>
              <td
                className={cn(
                  "px-4 py-2.5 text-right font-mono font-[650]",
                  scoreTone(pair.flagged, pair.window_jaccard),
                )}
              >
                {percent(pair.window_jaccard)}
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AIDetectionSection({ report }: { report: ToolReport }) {
  const detection = aiDetectionReportOf(report.payload);

  if (!detection) {
    return <EmptyReport>AI detection report was not returned in the expected shape.</EmptyReport>;
  }

  if (detection.submissions.length === 0) {
    return <EmptyReport>No AI detection flags reported.</EmptyReport>;
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-[var(--linear-border)] font-mono uppercase tracking-[0.08em] text-[10px] text-[var(--chat-text-muted)]">
            <th className="px-4 py-2.5 text-left font-[510]">Student</th>
            <th className="px-4 py-2.5 text-right font-[510]">AI score</th>
            <th className="px-4 py-2.5 text-right font-[510]">Flagged</th>
          </tr>
        </thead>
        <tbody>
          {detection.submissions.map((submission) => (
            <tr
              className="border-b border-[var(--linear-border-subtle)] text-[13px] last:border-b-0"
              key={submission.id}
            >
              <td className="px-4 py-2.5 font-[560] text-[var(--foreground)]">
                {studentLabel(submission.id)}
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
}: {
  kind: ReportKind;
  report: ToolReport | null;
}) {
  const sectionClass =
    kind === "similarity" || kind === "aiDetection"
      ? "no-scrollbar h-full min-h-0 overflow-auto pt-10 pb-10"
      : "no-scrollbar h-full min-h-0 overflow-auto px-4 py-4 pb-10";

  return (
    <section className={sectionClass}>
      {!report ? (
        <EmptyReport>No report has been returned yet.</EmptyReport>
      ) : kind === "similarity" ? (
        <SimilaritySection report={report} />
      ) : (
        <AIDetectionSection report={report} />
      )}
    </section>
  );
}
