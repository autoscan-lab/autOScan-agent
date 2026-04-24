import { ListChecksIcon } from "lucide-react";

import type { StudentInspectorRow } from "@/components/chat/support/types";
import { cn } from "@/lib/utils";
import { EmptyDetail, SectionLabel } from "./shared";

export function TestsSection({ student }: { student: StudentInspectorRow }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <ListChecksIcon className="size-4 text-[var(--chat-text-muted)]" />
        <SectionLabel>Test details</SectionLabel>
      </div>
      {student.tests?.cases.length ? (
        <div className="space-y-2">
          {student.tests.cases.map((testCase) => (
            <div
              className="flex items-center justify-between gap-3 rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] px-3 py-2 text-[13px]"
              key={`${testCase.index}-${testCase.name}`}
            >
              <span className="min-w-0 truncate text-[var(--foreground)]">
                {testCase.name ?? `Test ${testCase.index ?? ""}`}
              </span>
              <span
                className={cn(
                  "shrink-0 font-mono",
                  testCase.status === "pass"
                    ? "text-[var(--linear-success)]"
                    : "text-[var(--linear-danger)]",
                )}
              >
                {testCase.status ?? "unknown"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyDetail>Detailed test inspection is coming soon.</EmptyDetail>
      )}
    </section>
  );
}
