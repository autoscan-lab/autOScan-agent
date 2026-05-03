import type { ToolReport } from "@/components/chat/shared/types";
import { formatStudentName } from "@/components/chat/shared/display";
import { EmptyReport, ResultsTable } from "../ResultsTable";

type SimilarityPair = {
  a: string;
  b: string;
  flagged: boolean;
  similarity_percent: number;
};

type SimilarityReport = {
  pairs: SimilarityPair[];
  source_file: string;
};

const similarityTemplate =
  "minmax(10rem,1.4fr) minmax(10rem,1.4fr) minmax(7rem,0.7fr) minmax(6rem,0.6fr)";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function reportOf(payload: unknown): SimilarityReport | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.source_file !== "string" || !Array.isArray(payload.pairs)) {
    return null;
  }
  if (
    !payload.pairs.every(
      (pair) =>
        isRecord(pair) &&
        typeof pair.a === "string" &&
        typeof pair.b === "string" &&
        typeof pair.flagged === "boolean" &&
        isNumber(pair.similarity_percent),
    )
  ) {
    return null;
  }
  return { pairs: payload.pairs, source_file: payload.source_file };
}

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

  const similarity = reportOf(report.payload);
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
      rows={similarity.pairs.map((pair) => ({ ...pair, id: `${pair.a}-${pair.b}` }))}
      selectedId={selectedId}
      template={similarityTemplate}
    />
  );
}
