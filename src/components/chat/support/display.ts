export function formatStudentName(studentId: string) {
  const trimmed = studentId.trim();
  const tail = trimmed.split("/").pop();
  return tail && tail.length > 0 ? tail : trimmed;
}

export function initialsOf(name: string) {
  const parts = name
    .split(/[\s@.]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function statusTone(status: string | null) {
  const normalized = status?.toLowerCase().trim() ?? "";
  if (!normalized) {
    return "border-[var(--linear-border)] bg-[var(--linear-ghost)] text-[var(--chat-text-muted)]";
  }
  if (normalized.includes("ok") || normalized.includes("pass")) {
    return "border-[#27a644]/35 bg-[#27a644]/15 text-[#27a644]";
  }
  if (normalized.includes("fail") || normalized.includes("error")) {
    return "border-[var(--linear-danger)]/35 bg-[var(--linear-danger)]/12 text-[var(--linear-danger)]";
  }
  return "border-[var(--linear-border)] bg-[var(--linear-ghost)] text-[var(--chat-text-muted)]";
}

export function gradeTone(grade: number | null) {
  if (grade === null) {
    return "border-[var(--linear-border)] bg-[var(--linear-ghost)] text-[var(--chat-text-muted)]";
  }
  if (grade >= 90) {
    return "border-[var(--linear-success)]/35 bg-[var(--linear-success)]/15 text-[var(--linear-success)]";
  }
  if (grade >= 70) {
    return "border-[var(--linear-accent)]/35 bg-[var(--linear-accent)]/15 text-[var(--linear-accent-hover)]";
  }
  return "border-[var(--linear-danger)]/35 bg-[var(--linear-danger)]/12 text-[var(--linear-danger)]";
}
