import { ArrowLeftIcon, ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";

import type { StudentInspectorRow } from "@/components/chat/support/types";
import { cn } from "@/lib/utils";

type InspectorTestCase = NonNullable<StudentInspectorRow["tests"]>["cases"][number];

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
  testCase: InspectorTestCase,
  fallbackIndex: number,
) {
  return `${testCase.index ?? fallbackIndex}-${testCase.name ?? fallbackIndex}`;
}

export function TestsSection({ student }: { student: StudentInspectorRow }) {
  const [selectedCaseKey, setSelectedCaseKey] = useState<string | null>(null);
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
  const selectedCase = useMemo(
    () =>
      selectedCaseKey
        ? cases.find((testCase, caseIndex) =>
            testCaseKey(testCase, caseIndex) === selectedCaseKey,
          ) ?? null
        : null,
    [cases, selectedCaseKey],
  );
  const testSummary = student.tests;
  const totalCount = testSummary?.total ?? cases.length;
  const passedCount =
    testSummary?.passed ??
    cases.filter((testCase) => testCase.status === "pass").length;
  const failedCount =
    testSummary?.failed ??
    cases.filter((testCase) => testCase.status !== "pass").length;

  return (
    <section
      className={cn(
        "no-scrollbar relative h-full min-h-0 overflow-auto px-4 pb-6",
        selectedCase ? "pt-0" : "pt-10",
      )}
    >
      {selectedCase ? (
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex min-h-10 items-center gap-3 border-b border-[var(--linear-border-subtle)] pr-36">
            <button
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)] text-[var(--chat-text-secondary)] transition-colors hover:border-[var(--linear-border)] hover:bg-[var(--linear-ghost-hover)] hover:text-[var(--foreground)]"
              onClick={() => setSelectedCaseKey(null)}
              type="button"
            >
              <ArrowLeftIcon className="size-3.5" />
            </button>
            <h3 className="truncate text-[13px] font-[560] text-[var(--foreground)]">
              {selectedCase.name ?? `Test ${selectedCase.index ?? ""}`} diff
            </h3>
          </div>
          {selectedCase.message ? (
            <p className="pt-3 text-[12px] leading-relaxed text-[var(--chat-text-secondary)]">
              {selectedCase.message}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto pt-3">
            {selectedCase.diffLines.length > 0 ? (
              <pre className="font-mono text-[11px] leading-relaxed text-[var(--foreground)]">
                {selectedCase.diffLines.map((line, lineIndex) => (
                  <div
                    className={diffLineTone(line.type)}
                    key={`${selectedCase.index}-${line.lineNum ?? lineIndex}-${line.type}-${line.content}`}
                  >
                    <span>{diffLinePrefix(line.type)}</span>
                    <span>{line.content}</span>
                  </div>
                ))}
              </pre>
            ) : (
              <pre
                className={cn(
                  "font-mono text-[11px] leading-relaxed",
                  selectedCase.stderr
                    ? "text-[var(--linear-danger)]"
                    : "text-[var(--foreground)]",
                )}
              >
                {selectedCase.stderr || selectedCase.stdout || "No diff available."}
              </pre>
            )}
          </div>
        </div>
      ) : cases.length ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-surface)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--chat-text-muted)]">
                Tests
              </p>
              <p className="mt-1 font-mono text-[14px] text-[var(--foreground)]">
                {totalCount}
              </p>
            </div>
            <div className="rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-surface)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--chat-text-muted)]">
                Passed
              </p>
              <p className="mt-1 font-mono text-[14px] text-[var(--linear-success)]">
                {passedCount}
              </p>
            </div>
            <div className="rounded-md border border-[var(--linear-border-subtle)] bg-[var(--linear-surface)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--chat-text-muted)]">
                Failed
              </p>
              <p className="mt-1 font-mono text-[14px] text-[var(--linear-danger)]">
                {failedCount}
              </p>
            </div>
          </div>

          <div className="space-y-2">
          {cases.map((testCase, caseIndex) => {
            const passed = testCase.status === "pass";
            const hasDetails =
              testCase.diffLines.length > 0 || Boolean(testCase.stderr || testCase.stdout);
            return (
              <button
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-left text-[13px] transition-colors",
                  "border-[var(--linear-border-subtle)] bg-transparent",
                  hasDetails
                    ? "hover:border-[var(--linear-border)]"
                    : "cursor-default",
                )}
                disabled={!hasDetails}
                key={testCaseKey(testCase, caseIndex)}
                onClick={() => {
                  if (!hasDetails) {
                    return;
                  }
                  setSelectedCaseKey(testCaseKey(testCase, caseIndex));
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
                      <ChevronRightIcon className="size-3.5 text-[var(--chat-text-muted)]" />
                    ) : null}
                  </div>
                </div>
                {!passed && testCase.message ? (
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
            );
          })}
          </div>
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
