import type { ReactNode } from "react";

import { CodeBlockContent } from "@/components/chat/conversation/primitives/code-block";
import type { CodeHighlightRange } from "@/components/chat/conversation/primitives/code-block";
import type { ToolCodeSpan } from "@/components/chat/shared/tool-reports";
import { cn } from "@/lib/utils";

export function rangesForCodeSpans(
  spans: ToolCodeSpan[] | undefined,
  code: string | null | undefined,
): CodeHighlightRange[] {
  if (!spans?.length || !code) return [];

  const lineCount = code.split("\n").length;

  return spans.flatMap((span): CodeHighlightRange[] => {
    const startLine = Math.min(span.startLine, span.endLine);
    const endLine = Math.max(span.startLine, span.endLine);

    if (startLine < 1 || startLine > lineCount) return [];
    return [{
      endLine: Math.min(lineCount, endLine),
      startLine,
    }];
  });
}

export function SourceCodePanel({
  className,
  code,
  emptyMessage = "Source unavailable for this submission.",
  highlightedLineRanges,
  highlightedLine,
  lineIdPrefix,
}: {
  className?: string;
  code?: string | null;
  emptyMessage?: ReactNode;
  highlightedLineRanges?: CodeHighlightRange[];
  highlightedLine?: number;
  lineIdPrefix?: string;
}) {
  return (
    <div className={cn("h-full min-h-0", className)}>
      {code ? (
        <div className="no-scrollbar h-full overflow-auto bg-transparent text-[12px] [&_[data-code-line]>span]:!bg-transparent [&_code]:!text-[12px] [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-3 [&_pre]:!leading-[1.55]">
          <CodeBlockContent
            code={code}
            highlightedLineRanges={highlightedLineRanges}
            highlightedLine={highlightedLine}
            language="c"
            lineIdPrefix={lineIdPrefix}
            showLineNumbers
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center px-6">
          <p className="rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] px-3 py-2 text-[13px] text-[var(--chat-text-muted)]">
            {emptyMessage}
          </p>
        </div>
      )}
    </div>
  );
}
