import type { ToolReport } from "@/components/chat/shared/types";
import { formatStudentName } from "@/components/chat/shared/display";
import { EmptyReport, ResultsTable } from "../ResultsTable";

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

export function AIDetectionTable({
  onRowSelect,
  report,
  selectedId,
}: {
  onRowSelect?: (row: AIDetectionSubmission) => void;
  report: ToolReport | null;
  selectedId?: string | null;
}) {
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
            <span className="block truncate">{formatStudentName(row.id)}</span>
          ),
        },
        {
          key: "score",
          label: "AI Score",
          render: (row) => (
            <span>{row.parse_error ? "Error" : `${Math.round(row.best_score * 100)}%`}</span>
          ),
        },
        {
          key: "flagged",
          label: "Flagged",
          render: (row) => <span>{row.flagged ? "Yes" : "No"}</span>,
        },
      ]}
      onRowSelect={onRowSelect}
      rows={detection.submissions}
      selectedId={selectedId}
      template={aiDetectionTemplate}
    />
  );
}
