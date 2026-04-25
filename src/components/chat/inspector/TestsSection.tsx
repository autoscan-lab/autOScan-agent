import { useMemo } from "react";

import type { StudentInspectorRow } from "@/components/chat/support/types";
import { cn } from "@/lib/utils";

export function TestsSection({ student }: { student: StudentInspectorRow }) {
  const cases = useMemo(
    () =>
      [...(student.tests?.cases ?? [])].sort((a, b) => {
        if (a.status === b.status) {
          return (a.index ?? 0) - (b.index ?? 0);
        }
        if (a.status === "pass") {
          return 1;
        }
        if (b.status === "pass") {
          return -1;
        }
        return (a.index ?? 0) - (b.index ?? 0);
      }),
    [student.tests?.cases],
  );

  return (
    <section className="h-full min-h-0 overflow-auto px-4 py-4 pb-28">
      {cases.length ? (
        <div className="space-y-2">
          {cases.map((testCase) => {
            const passed = testCase.status === "pass";
            return (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-[13px]",
                  passed
                    ? "border-[var(--linear-border-subtle)] bg-transparent"
                    : "border-[var(--linear-danger)]/25 bg-[var(--linear-danger)]/10",
                )}
                key={`${testCase.index}-${testCase.name}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[var(--foreground)]">
                    {testCase.name ?? `Test ${testCase.index ?? ""}`}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-mono",
                      passed
                        ? "text-[var(--linear-success)]"
                        : "text-[var(--linear-danger)]",
                    )}
                  >
                    {testCase.status ?? "unknown"}
                  </span>
                </div>
                {!passed && testCase.message ? (
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--chat-text-secondary)]">
                    {testCase.message}
                  </p>
                ) : null}
                {!passed && testCase.outputMatch ? (
                  <p className="mt-1 font-mono text-[11px] text-[var(--chat-text-muted)]">
                    output: {testCase.outputMatch}
                  </p>
                ) : null}
                {!passed && (testCase.stderr || testCase.stdout) ? (
                  <pre
                    className={cn(
                      "mt-2 max-h-36 overflow-auto rounded-sm border border-[var(--linear-border-subtle)] bg-[var(--linear-panel)] px-2 py-1.5 font-mono text-[11px] leading-relaxed",
                      testCase.stderr
                        ? "text-[var(--linear-danger)]"
                        : "text-[var(--foreground)]",
                    )}
                  >
                    {testCase.stderr || testCase.stdout}
                  </pre>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-[13px] text-[var(--chat-text-muted)]">
            No test details reported.
          </p>
        </div>
      )}
    </section>
  );
}
