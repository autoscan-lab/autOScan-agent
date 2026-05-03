import type { ToolReport } from "@/components/chat/shared/types";
import { EmptyReport, ResultsTable } from "./ResultsTable";

type AIDetectionSubmission = {
  best_score: number;
  flagged: boolean;
  id: string;
  match_count?: number;
  parse_error?: string;
};

type AIDetectionReport = {
  dictionary_entry_count: number;
  dictionary_usable: number;
  source_file: string;
  submissions: AIDetectionSubmission[];
};

const aiDetectionTemplate =
  "minmax(10rem,1.6fr) minmax(7rem,0.7fr) minmax(6rem,0.6fr)";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function reportOf(payload: unknown): AIDetectionReport | null {
  if (!isRecord(payload)) return null;
  if (
    typeof payload.source_file !== "string" ||
    !isNumber(payload.dictionary_entry_count) ||
    !isNumber(payload.dictionary_usable) ||
    !Array.isArray(payload.submissions)
  ) {
    return null;
  }
  if (
    !payload.submissions.every(
      (submission) =>
        isRecord(submission) &&
        typeof submission.id === "string" &&
        typeof submission.flagged === "boolean" &&
        isNumber(submission.best_score),
    )
  ) {
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

function studentLabel(value: string) {
  const parts = value.split("/").filter(Boolean);
  return parts.at(-1) ?? value;
}

function scoreTone(flagged: boolean, score: number) {
  if (flagged) return "text-[var(--linear-danger)]";
  if (score >= 0.5) return "text-orange-300";
  return "text-[var(--chat-text-muted)]";
}

export function AIDetectionTable({ report }: { report: ToolReport | null }) {
  if (!report) return <EmptyReport>No report has been returned yet.</EmptyReport>;

  const detection = reportOf(report.payload);
  if (!detection) {
    return (
      <EmptyReport>
        AI detection report was not returned in the expected shape.
      </EmptyReport>
    );
  }

  return (
    <ResultsTable
      columns={[
        {
          key: "student",
          label: "Student",
          render: (row) => (
            <span className="block truncate font-[510] text-[var(--foreground)]">
              {studentLabel(row.id)}
            </span>
          ),
        },
        {
          key: "score",
          label: "AI Score",
          render: (row) => (
            <span
              className={
                row.parse_error
                  ? "text-[var(--linear-danger)]"
                  : scoreTone(row.flagged, row.best_score)
              }
            >
              {row.parse_error ? "Error" : percent(row.best_score)}
            </span>
          ),
        },
        {
          key: "flagged",
          label: "Flagged",
          render: (row) => (
            <span
              className={
                row.flagged
                  ? "text-[var(--linear-danger)]"
                  : "text-[var(--chat-text-muted)]"
              }
            >
              {row.flagged ? "Yes" : "No"}
            </span>
          ),
        },
      ]}
      rows={detection.submissions}
      template={aiDetectionTemplate}
    />
  );
}
