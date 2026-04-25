"use client";

import {
  ChevronDownIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { GradingRunResponse } from "../support/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SourceSection } from "./SourceSection";
import { StatusDrawer } from "./StatusDrawer";
import { TestsSection } from "./TestsSection";

export type InspectorPanelProps = {
  data: GradingRunResponse | null;
  error: string | null;
  loading: boolean;
  selectedStudentId: string | null;
};

type InspectorView = "source" | "tests";

function viewLabel(view: InspectorView) {
  return view === "source" ? "Source" : "Tests";
}

function InspectorControls({
  setView,
  view,
}: {
  setView?: (view: InspectorView) => void;
  view?: InspectorView;
}) {
  return (
    <div className="absolute right-10 top-[3px] z-10 flex items-center gap-2">
      {view && setView ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--linear-border)] bg-[#030304]/90 px-2.5 text-[11px] font-[510] text-[var(--chat-text-secondary)] shadow-[var(--shadow-dialog)] backdrop-blur-md transition-colors hover:bg-[#08080a] hover:text-[var(--foreground)]">
              {viewLabel(view)}
              <ChevronDownIcon className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-28 border border-[var(--linear-border)] bg-[#050506] text-[var(--foreground)]"
            >
              {(["source", "tests"] as InspectorView[]).map((value) => (
                <DropdownMenuItem
                  className="text-[12px]"
                  key={value}
                  onClick={() => setView(value)}
                >
                  {viewLabel(value)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span
            aria-hidden
            className="hidden h-5 w-px bg-[var(--linear-border)] md:block"
          />
        </>
      ) : null}
    </div>
  );
}

export function InspectorPanel({
  data,
  error,
  loading,
  selectedStudentId,
}: InspectorPanelProps) {
  const students = useMemo(() => data?.students ?? [], [data?.students]);
  const selectedStudent = useMemo(() => {
    if (students.length === 0) {
      return null;
    }
    return (
      students.find((student) => student.studentId === selectedStudentId) ??
      students[0]
    );
  }, [students, selectedStudentId]);

  const hasStudents = students.length > 0;
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [view, setView] = useState<InspectorView>("source");

  function revealSourceLine(line: number) {
    setView("source");
    setHighlightedLine(line);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {error ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[13px] text-[var(--linear-danger)]">
          {error}
        </div>
      ) : loading && !data ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--chat-text-muted)]">
          <RefreshCwIcon className="mr-2 size-4 animate-spin" />
          Loading...
        </div>
      ) : !hasStudents ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[13px] text-[var(--chat-text-muted)]">
          No grading results yet
        </div>
      ) : selectedStudent ? (
        <>
          <InspectorControls
            setView={setView}
            view={view}
          />

          <div className="min-h-0 flex-1 pb-14 pt-0">
            {view === "source" ? (
              <SourceSection
                highlightedLine={highlightedLine}
                student={selectedStudent}
              />
            ) : (
              <TestsSection student={selectedStudent} />
            )}
          </div>

          <div className="absolute inset-x-0 bottom-0 z-10">
            <StatusDrawer
              onRevealLine={revealSourceLine}
              student={selectedStudent}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
