import type { ReactNode } from "react";

import { CodeBlockContent } from "@/components/chat/conversation/primitives/code-block";
import { cn } from "@/lib/utils";

export function SourceCodePanel({
  className,
  code,
  emptyMessage = "Source unavailable for this submission.",
  highlightedLine,
  lineIdPrefix,
}: {
  className?: string;
  code?: string | null;
  emptyMessage?: ReactNode;
  highlightedLine?: number;
  lineIdPrefix?: string;
}) {
  return (
    <div className={cn("h-full min-h-0", className)}>
      {code ? (
        <div className="no-scrollbar h-full overflow-auto bg-transparent text-[12px] [&_code]:!text-[12px] [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-3 [&_pre]:!leading-[1.55] [&_span]:!bg-transparent">
          <CodeBlockContent
            code={code}
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
