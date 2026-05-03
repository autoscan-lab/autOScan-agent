import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ResultsTableColumn<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
};

const tableShadow =
  "shadow-[0_16px_44px_-28px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.03)]";

export function EmptyReport({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--linear-border-subtle)] px-6 py-12 text-center text-[13px] text-[var(--chat-text-muted)]">
      {children}
    </div>
  );
}

export function ResultsTable<T extends { id: string }>({
  columns,
  onRowSelect,
  rows,
  selectedId,
  template,
}: {
  columns: ResultsTableColumn<T>[];
  onRowSelect?: (row: T) => void;
  rows: T[];
  selectedId?: string | null;
  template: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg bg-[var(--linear-panel)]",
        tableShadow,
      )}
    >
      <div
        className="grid border-b border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--chat-text-muted)]"
        style={{ gridTemplateColumns: template }}
      >
        {columns.map((column) => (
          <div className="px-4 py-2.5 font-[510]" key={column.key}>
            {column.label}
          </div>
        ))}
      </div>
      {rows.map((row) => {
        const selected = selectedId === row.id;
        const rowClassName = cn(
          "grid w-full border-b border-[var(--linear-border-subtle)] text-left text-[13px] last:border-b-0",
          onRowSelect &&
            "transition-colors hover:bg-[var(--linear-ghost-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--linear-accent)]",
          selected && "bg-[var(--linear-accent)]/10",
        );

        const content = columns.map((column) => (
          <div className="min-w-0 px-4 py-3 font-[510]" key={column.key}>
            {column.render(row)}
          </div>
        ));

        return onRowSelect ? (
          <button
            aria-pressed={selected}
            className={rowClassName}
            key={row.id}
            onClick={() => onRowSelect(row)}
            style={{ gridTemplateColumns: template }}
            type="button"
          >
            {content}
          </button>
        ) : (
          <div
            className={rowClassName}
            key={row.id}
            style={{ gridTemplateColumns: template }}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
