import type { ReactNode } from "react";
import { ArrowLeftIcon } from "lucide-react";

export function DetailHeader({
  children,
  onBack,
}: {
  children: ReactNode;
  onBack: () => void;
}) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--linear-border-subtle)] px-3">
      <button
        aria-label="Back to table"
        className="inline-flex size-7 items-center justify-center rounded-md text-[var(--chat-text-secondary)] transition-colors hover:bg-[var(--linear-ghost)] hover:text-[var(--foreground)]"
        onClick={onBack}
        type="button"
      >
        <ArrowLeftIcon className="size-3.5" />
      </button>
      {children}
    </div>
  );
}
