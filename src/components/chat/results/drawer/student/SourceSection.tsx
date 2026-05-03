import { useEffect } from "react";

import type { StudentResultRow } from "@/components/chat/shared/types";
import { SourceCodePanel } from "../SourceCodePanel";

const sourceLineIdPrefix = "student-source-line";

export function SourceSection({
  highlightedLine,
  student,
}: {
  highlightedLine: number | null;
  student: StudentResultRow;
}) {
  useEffect(() => {
    if (!highlightedLine) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`${sourceLineIdPrefix}-${highlightedLine}`)
        ?.scrollIntoView({ block: "center" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [highlightedLine]);

  return (
    <section className="h-full min-h-0">
      <SourceCodePanel
        code={student.sourceText}
        emptyMessage="Source unavailable for this run."
        highlightedLine={highlightedLine ?? undefined}
        lineIdPrefix={sourceLineIdPrefix}
      />
    </section>
  );
}
