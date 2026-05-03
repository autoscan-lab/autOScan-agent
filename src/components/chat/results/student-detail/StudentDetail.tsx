"use client";

import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { StudentResultRow } from "@/components/chat/shared/types";
import { formatStudentName } from "@/components/chat/shared/display";
import { SourceSection } from "./SourceSection";
import { StatusDrawer } from "./StatusDrawer";
import { TestsSection } from "./TestsSection";

type DetailTab = "source" | "tests";

export function StudentDetail({
  onClose,
  onNavigate,
  student,
  students,
}: {
  onClose: () => void;
  onNavigate: (studentId: string) => void;
  student: StudentResultRow;
  students: StudentResultRow[];
}) {
  const [tab, setTab] = useState<DetailTab>("source");
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  const currentIndex = students.findIndex((s) => s.studentId === student.studentId);
  const prevStudent = currentIndex > 0 ? students[currentIndex - 1] : null;
  const nextStudent = currentIndex < students.length - 1 ? students[currentIndex + 1] : null;

  function revealSourceLine(line: number) {
    setTab("source");
    setHighlightedLine(line);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function closeWithAnimation() {
    setVisible(false);
    window.setTimeout(onClose, 220);
  }

  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex origin-top flex-col overflow-hidden bg-[var(--chat-bg)] transition-[clip-path,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        visible
          ? "opacity-100 [clip-path:inset(0_0_0_0)]"
          : "opacity-0 [clip-path:inset(0_0_100%_0)]",
      )}
    >
      {/* Sticky header */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--linear-border-subtle)] px-3">
        <button
          aria-label="Back to table"
          className="inline-flex size-7 items-center justify-center rounded-md text-[var(--chat-text-secondary)] transition-colors hover:bg-[var(--linear-ghost)] hover:text-[var(--foreground)]"
          onClick={closeWithAnimation}
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

        {/* Tab switcher */}
        <div className="flex items-center gap-0.5 rounded-md bg-[var(--linear-ghost)] p-0.5">
          {(["source", "tests"] as const).map((t) => (
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

      {/* Content */}
      <div className="relative min-h-0 flex-1">
        {tab === "source" ? (
          <SourceSection highlightedLine={highlightedLine} student={student} />
        ) : (
          <TestsSection student={student} />
        )}

        <div className="absolute inset-x-0 bottom-0 z-10">
          <StatusDrawer onRevealLine={revealSourceLine} student={student} />
        </div>
      </div>
    </div>
  );
}
