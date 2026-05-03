import { useEffect } from "react";
import type { ReactNode } from "react";

import { CodeBlockContent } from "@/components/chat/conversation/primitives/code-block";
import type { StudentResultRow } from "@/components/chat/shared/types";

function EmptyDetail({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] px-3 py-2 text-[13px] text-[var(--chat-text-muted)]">
      {children}
    </p>
  );
}

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
      {student.sourceText ? (
        <div className="no-scrollbar h-full overflow-auto bg-transparent text-[12px] [&_code]:!text-[12px] [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-3 [&_pre]:!leading-[1.55] [&_span]:!bg-transparent">
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
