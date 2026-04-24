import type { StudentInspectorRow } from "@/components/chat/support/types";
import { cn } from "@/lib/utils";
import {
  formatStudentName,
  gradeTone,
  statusTone,
} from "../support/display";
import { SectionLabel } from "./shared";

function gradeLabel(student: StudentInspectorRow) {
  return student.grade === null ? "-" : String(student.grade);
}

export function StudentHeader({ student }: { student: StudentInspectorRow }) {
  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <SectionLabel>Student</SectionLabel>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate font-mono text-[28px] font-[510] tracking-[-0.04em] text-[var(--foreground)]">
              {formatStudentName(student.studentId)}
            </p>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-[510]",
                statusTone(student.status),
              )}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {student.status ?? "unknown"}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <SectionLabel>Grade</SectionLabel>
          <p
            className={cn(
              "mt-1 font-heading text-[46px] font-[510] leading-none tracking-[-0.06em] tabular-nums",
              gradeTone(student.grade),
            )}
          >
            {gradeLabel(student)}
          </p>
        </div>
      </div>
    </section>
  );
}
