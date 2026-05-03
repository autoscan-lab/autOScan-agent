"use client";

import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { StudentResultRow } from "@/components/chat/shared/types";
import { formatStudentName } from "@/components/chat/shared/display";
import { DetailDrawer } from "../DetailDrawer";
import { SourceSection } from "./SourceSection";
import { BannedSection, CompileSection } from "./StatusSection";
import { TestsSection } from "./TestsSection";

type DetailTab = "source" | "tests" | "compile" | "banned";

export function StudentDetail({
  onClose,
  onCloseStart,
  onNavigate,
  student,
  students,
}: {
  onClose: () => void;
  onCloseStart?: () => void;
  onNavigate: (studentId: string) => void;
  student: StudentResultRow;
  students: StudentResultRow[];
}) {
  const [tab, setTab] = useState<DetailTab>("source");
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);

  const currentIndex = students.findIndex((s) => s.studentId === student.studentId);
  const prevStudent = currentIndex > 0 ? students[currentIndex - 1] : null;
  const nextStudent = currentIndex < students.length - 1 ? students[currentIndex + 1] : null;

  function revealSourceLine(line: number) {
    setTab("source");
    setHighlightedLine(line);
  }

  return (
    <DetailDrawer onClose={onClose} onCloseStart={onCloseStart}>
      {(close) => (
        <>
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--linear-border-subtle)] px-3">
            <button
              aria-label="Back to table"
              className="inline-flex size-7 items-center justify-center rounded-md text-[var(--chat-text-secondary)] transition-colors hover:bg-[var(--linear-ghost)] hover:text-[var(--foreground)]"
              onClick={close}
              type="button"
            >
              <ArrowLeftIcon className="size-3.5" />
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-[13px] font-[510] text-[var(--foreground)]">
                {formatStudentName(student.studentId)}
              </span>

              <div className="flex items-center gap-0.5">
                <button
                  aria-label="Previous student"
                  className="inline-flex size-6 items-center justify-center rounded text-[var(--chat-text-muted)] transition-colors hover:bg-[var(--linear-ghost)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30"
                  disabled={!prevStudent}
                  onClick={() => prevStudent && onNavigate(prevStudent.studentId)}
                  type="button"
                >
                  <ChevronLeftIcon className="size-3.5" />
                </button>
                <span className="tabular-nums text-[11px] text-[var(--chat-text-muted)]">
                  {currentIndex + 1}/{students.length}
                </span>
                <button
                  aria-label="Next student"
                  className="inline-flex size-6 items-center justify-center rounded text-[var(--chat-text-muted)] transition-colors hover:bg-[var(--linear-ghost)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30"
                  disabled={!nextStudent}
                  onClick={() => nextStudent && onNavigate(nextStudent.studentId)}
                  type="button"
                >
                  <ChevronRightIcon className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-0.5 rounded-md bg-[var(--linear-ghost)] p-0.5">
              {(["source", "tests", "compile", "banned"] as const).map((t) => (
                <button
                  className={cn(
                    "rounded px-3 py-1 text-[12px] font-[510] capitalize transition-colors",
                    tab === t
                      ? "bg-[var(--linear-panel)] text-[var(--foreground)]"
                      : "text-[var(--chat-text-muted)] hover:text-[var(--foreground)]",
                  )}
                  key={t}
                  onClick={() => {
                    setTab(t);
                    if (t === "source") setHighlightedLine(null);
                  }}
                  type="button"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            {tab === "source" ? (
              <SourceSection highlightedLine={highlightedLine} student={student} />
            ) : tab === "tests" ? (
              <TestsSection student={student} />
            ) : tab === "compile" ? (
              <CompileSection student={student} />
            ) : (
              <BannedSection onRevealLine={revealSourceLine} student={student} />
            )}
          </div>
        </>
      )}
    </DetailDrawer>
  );
}
