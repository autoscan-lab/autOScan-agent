import type { StudentInspectorRow } from "@/components/chat/support/types";
import { SectionLabel } from "./shared";

export function NotesSection({ student }: { student: StudentInspectorRow }) {
  if (!student.notes) {
    return null;
  }

  return (
    <section className="-mx-6 border-b border-[var(--linear-border-subtle)] px-6 pb-5">
      <SectionLabel>Notes</SectionLabel>
      <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--chat-text-secondary)]">
        {student.notes}
      </p>
    </section>
  );
}
