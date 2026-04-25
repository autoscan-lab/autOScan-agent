import { CodeBlockContent } from "@/components/chat/ai-elements/code-block";
import type { StudentInspectorRow } from "@/components/chat/support/types";
import { EmptyDetail } from "./shared";
import { useEffect } from "react";

const sourceLineIdPrefix = "inspector-source-line";

export function SourceSection({
  highlightedLine,
  student,
}: {
  highlightedLine: number | null;
  student: StudentInspectorRow;
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
      {student.sourceText ? (
        <div className="h-full overflow-auto bg-transparent pb-16 text-[12px] [&_code]:!text-[12px] [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-3 [&_pre]:!leading-[1.55] [&_span]:!bg-transparent">
          <CodeBlockContent
            code={student.sourceText}
            highlightedLine={highlightedLine ?? undefined}
            language="c"
            lineIdPrefix={sourceLineIdPrefix}
            showLineNumbers
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center px-6 pb-20">
          <EmptyDetail>Source unavailable for this run.</EmptyDetail>
        </div>
      )}
    </section>
  );
}
