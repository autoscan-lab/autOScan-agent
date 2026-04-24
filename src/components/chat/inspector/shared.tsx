export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--chat-text-muted)]">
      {children}
    </p>
  );
}

export function EmptyDetail({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] px-3 py-2 text-[13px] text-[var(--chat-text-muted)]">
      {children}
    </p>
  );
}
