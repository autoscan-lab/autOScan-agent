import { ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";

import type { StudentResultRow } from "@/components/chat/shared/types";
import { cn } from "@/lib/utils";

type ResultTestCase = NonNullable<StudentResultRow["tests"]>["cases"][number];

function diffLineTone(type: string) {
  if (type === "delete" || type === "removed" || type === "expected") {
    return "text-[var(--linear-danger)]";
  }
  if (type === "insert" || type === "added" || type === "actual") {
    return "text-[var(--linear-success)]";
  }
  return "text-[var(--chat-text-secondary)]";
}

function diffLinePrefix(type: string) {
  if (type === "delete" || type === "removed" || type === "expected") {
    return "-";
  }
  if (type === "insert" || type === "added" || type === "actual") {
    return "+";
  }
  return " ";
}

function expectedOutputNote(outputMatch: string | null) {
  if (outputMatch === "none") {
    return "No expected output.";
  }
  if (outputMatch === "missing") {
    return "Expected output missing.";
  }
  if (outputMatch === "pass" || outputMatch === "fail") {
    return "Has expected output.";
  }
  return "Expected output unknown.";
}

function testCaseKey(
  testCase: ResultTestCase,
  fallbackIndex: number,
) {
  return `${testCase.index ?? fallbackIndex}-${testCase.name ?? fallbackIndex}`;
}

export function TestsSection({ student }: { student: StudentResultRow }) {
  const [expandedCaseKey, setExpandedCaseKey] = useState<string | null>(null);
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
    <section className="no-scrollbar relative h-full min-h-0 overflow-auto px-4 py-3">
      {cases.length ? (
        <div className="space-y-3">
          {cases.map((testCase, caseIndex) => {
            const passed = testCase.status === "pass";
            const hasDetails =
              testCase.diffLines.length > 0 || Boolean(testCase.stderr || testCase.stdout);
            const key = testCaseKey(testCase, caseIndex);
            const expanded = expandedCaseKey === key;
            return (
              <div
                className={cn(
                  "rounded-md border text-[13px] transition-colors",
                  "border-[var(--linear-border-subtle)] bg-transparent",
                  hasDetails && "hover:border-[var(--linear-border)]",
                )}
                key={key}
              >
                <button
                  className={cn(
                    "w-full px-3 py-2 text-left",
                    hasDetails ? "cursor-pointer" : "cursor-default",
                  )}
                  disabled={!hasDetails}
                  onClick={() => {
                    if (!hasDetails) return;
                    setExpandedCaseKey(expanded ? null : key);
                  }}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[var(--foreground)]">
                      {testCase.name ?? `Test ${testCase.index ?? ""}`}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          "font-mono",
                          passed
                            ? "text-[var(--linear-success)]"
                            : "text-[var(--linear-danger)]",
                        )}
                      >
                        {testCase.status ?? "unknown"}
                      </span>
                      {hasDetails ? (
                        <ChevronRightIcon
                          className={cn(
                            "size-3.5 text-[var(--chat-text-muted)] transition-transform",
                            expanded && "rotate-90",
                          )}
                        />
                      ) : null}
                    </div>
                  </div>
                  {testCase.message ? (
                    <p className="mt-2 text-[12px] leading-relaxed text-[var(--chat-text-secondary)]">
                      {testCase.message}
                    </p>
                  ) : null}
                  {testCase.outputMatch ? (
                    <p className="mt-1 font-mono text-[11px] text-[var(--chat-text-muted)]">
                      {expectedOutputNote(testCase.outputMatch)}
                    </p>
                  ) : null}
                </button>

                {expanded ? (
                  <div className="border-t border-[var(--linear-border-subtle)] px-3 py-3">
                    {testCase.diffLines.length > 0 ? (
                      <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-[var(--foreground)]">
                        {testCase.diffLines.map((line, lineIndex) => (
                          <div
                            className={diffLineTone(line.type)}
                            key={`${testCase.index}-${line.lineNum ?? lineIndex}-${line.type}-${line.content}`}
                          >
                            <span>{diffLinePrefix(line.type)}</span>
                            <span>{line.content}</span>
                          </div>
                        ))}
                      </pre>
                    ) : (
                      <pre
                        className={cn(
                          "overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed",
                          testCase.stderr
                            ? "text-[var(--linear-danger)]"
                            : "text-[var(--foreground)]",
                        )}
                      >
                        {testCase.stderr || testCase.stdout || "No diff available."}
                      </pre>
                    )}
                    {testCase.stderr && testCase.diffLines.length > 0 ? (
                      <div className="mt-4 border-t border-[var(--linear-border-subtle)] pt-3">
                        <p className="mb-1 text-[11px] font-[560] text-[var(--chat-text-muted)]">
                          stderr:
                        </p>
                        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--linear-danger)]">
                          {testCase.stderr}
                        </pre>
                      </div>
                    ) : null}
                  </div>
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
