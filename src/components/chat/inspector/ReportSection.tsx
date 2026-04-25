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

function titleFor(kind: ReportKind) {
  return kind === "similarity" ? "Similarity" : "AI detection";
}

function EmptyReport({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[min(18rem,55vh)] items-center justify-center px-6 text-center text-[13px] text-[var(--chat-text-muted)]">
      {children}
    </div>
  );
}

function ReportHeader({
  assignmentName,
  kind,
  sourceFile,
}: {
  assignmentName: string | null;
  kind: ReportKind;
  sourceFile: string | null;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[13px] font-[650] text-[var(--foreground)]">
          {titleFor(kind)}
        </h2>
        {sourceFile ? (
          <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--chat-text-muted)]">
            {sourceFile}
          </p>
        ) : null}
      </div>
      {assignmentName ? (
        <span className="shrink-0 font-mono text-[11px] text-[var(--chat-text-muted)]">
          {assignmentName}
        </span>
      ) : null}
    </div>
  );
}

function SimilaritySection({ report }: { report: ToolReport }) {
  const similarity = similarityReportOf(report.payload);

  if (!similarity) {
    return (
      <>
        <ReportHeader
          assignmentName={report.assignmentName}
          kind="similarity"
          sourceFile={null}
        />
        <EmptyReport>Similarity report was not returned in the expected shape.</EmptyReport>
      </>
    );
  }

  return (
    <>
      <ReportHeader
        assignmentName={report.assignmentName}
        kind="similarity"
        sourceFile={similarity.source_file}
      />
      {similarity.pairs.length > 0 ? (
        <div className="overflow-hidden rounded-lg bg-[var(--linear-ghost)]">
          {similarity.pairs.map((pair) => (
            <div
              className="border-b border-[var(--linear-border-subtle)] px-3 py-2.5 last:border-b-0"
              key={`${pair.a}-${pair.b}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-[560] text-[var(--foreground)]">
                    {pair.a} / {pair.b}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--chat-text-muted)]">
                    {pair.flagged ? "flagged" : "not flagged"} ·{" "}
                    {pair.window_matches} shared windows
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[12px] font-[650]",
                    scoreTone(pair.flagged, pair.window_jaccard),
                  )}
                >
                  {percent(pair.window_jaccard)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyReport>No similar submissions reported.</EmptyReport>
      )}
    </>
  );
}

function AIDetectionSection({ report }: { report: ToolReport }) {
  const detection = aiDetectionReportOf(report.payload);

  if (!detection) {
    return (
      <>
        <ReportHeader
          assignmentName={report.assignmentName}
          kind="aiDetection"
          sourceFile={null}
        />
        <EmptyReport>AI detection report was not returned in the expected shape.</EmptyReport>
      </>
    );
  }

  return (
    <>
      <ReportHeader
        assignmentName={report.assignmentName}
        kind="aiDetection"
        sourceFile={detection.source_file}
      />
      {detection.submissions.length > 0 ? (
        <div className="overflow-hidden rounded-lg bg-[var(--linear-ghost)]">
          {detection.submissions.map((submission) => (
            <div
              className="border-b border-[var(--linear-border-subtle)] px-3 py-2.5 last:border-b-0"
              key={submission.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-[560] text-[var(--foreground)]">
                    {submission.id}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--chat-text-muted)]">
                    {submission.parse_error
                      ? "parse error"
                      : submission.flagged
                        ? "flagged"
                        : "not flagged"}
                    {submission.match_count
                      ? ` · ${submission.match_count} matches`
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[12px] font-[650]",
                    submission.parse_error
                      ? "text-[var(--linear-danger)]"
                      : scoreTone(submission.flagged, submission.best_score),
                  )}
                >
                  {submission.parse_error ? "error" : percent(submission.best_score)}
                </span>
              </div>
              {submission.parse_error ? (
                <p className="mt-2 text-[12px] leading-relaxed text-[var(--linear-danger)]">
                  {submission.parse_error}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyReport>No AI detection flags reported.</EmptyReport>
      )}
    </>
  );
}

export function ReportSection({
  kind,
  report,
}: {
  kind: ReportKind;
  report: ToolReport | null;
}) {
  return (
    <section className="no-scrollbar h-full min-h-0 overflow-auto px-4 py-4 pb-10">
      {!report ? (
        <>
          <ReportHeader
            assignmentName={null}
            kind={kind}
            sourceFile={null}
          />
          <EmptyReport>No report has been returned yet.</EmptyReport>
        </>
      ) : kind === "similarity" ? (
        <SimilaritySection report={report} />
      ) : (
        <AIDetectionSection report={report} />
      )}
    </section>
  );
}
