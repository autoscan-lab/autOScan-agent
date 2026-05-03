import type { ToolReport } from "@/components/chat/shared/types";
import { formatStudentName } from "@/components/chat/shared/display";
import {
  aiDetectionReportOf,
  type AIDetectionSubmission,
} from "@/components/chat/shared/tool-reports";
import { EmptyReport, ResultsTable } from "../ResultsTable";

const aiDetectionTemplate =
  "minmax(10rem,1.6fr) minmax(7rem,0.7fr) minmax(6rem,0.6fr)";

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

  const detection = aiDetectionReportOf(report);
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
