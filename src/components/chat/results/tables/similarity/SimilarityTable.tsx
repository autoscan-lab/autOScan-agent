import type { ToolReport } from "@/components/chat/shared/types";
import { formatStudentName } from "@/components/chat/shared/display";
import {
  similarityReportOf,
  type SimilarityPair,
} from "@/components/chat/shared/tool-reports";
import { EmptyReport, ResultsTable } from "../ResultsTable";

const similarityTemplate =
  "minmax(10rem,1.4fr) minmax(10rem,1.4fr) minmax(7rem,0.7fr) minmax(6rem,0.6fr)";

export function SimilarityTable({
  onRowSelect,
  report,
  selectedId,
}: {
  onRowSelect?: (row: SimilarityPair & { id: string }) => void;
  report: ToolReport | null;
  selectedId?: string | null;
}) {
  if (!report) return <EmptyReport>No report has been returned yet.</EmptyReport>;

  const similarity = similarityReportOf(report);
  if (!similarity) {
    return (
      <EmptyReport>
        Similarity report was not returned in the expected shape.
      </EmptyReport>
    );
  }

  return (
    <ResultsTable
      columns={[
        {
          key: "studentA",
          label: "Student A",
          render: (row) => (
            <span className="block truncate">{formatStudentName(row.a)}</span>
          ),
        },
        {
          key: "studentB",
          label: "Student B",
          render: (row) => (
            <span className="block truncate">{formatStudentName(row.b)}</span>
          ),
        },
        {
          key: "similarity",
          label: "Similarity",
          render: (row) => <span>{Math.round(row.similarity_percent)}%</span>,
        },
        {
          key: "flagged",
          label: "Flagged",
          render: (row) => <span>{row.flagged ? "Yes" : "No"}</span>,
        },
      ]}
      onRowSelect={onRowSelect}
      rows={similarity.pairs}
      selectedId={selectedId}
      template={similarityTemplate}
    />
  );
}
