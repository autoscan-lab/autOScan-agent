"use client";

import { ChevronDownIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  GradingRunResponse,
  InspectorView,
  ToolReport,
} from "../support/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SourceSection } from "./SourceSection";
import { StatusDrawer } from "./StatusDrawer";
import { TestsSection } from "./TestsSection";
import { ReportSection } from "./ReportSection";

export type InspectorPanelProps = {
  aiDetectionReport: ToolReport | null;
  data: GradingRunResponse | null;
  error: string | null;
  loading: boolean;
  onViewChange: (view: InspectorView) => void;
  selectedStudentId: string | null;
  similarityReport: ToolReport | null;
  view: InspectorView;
};

function viewLabel(view: InspectorView) {
  if (view === "source") {
    return "Source";
  }
  if (view === "tests") {
    return "Tests";
  }
  return view === "similarity" ? "Similarity" : "AI detection";
}

function InspectorControls({
  availableViews,
  setView,
  view,
}: {
  availableViews: InspectorView[];
  setView: (view: InspectorView) => void;
  view: InspectorView;
}) {
  if (availableViews.length <= 1) {
    return null;
  }

  return (
    <div className="absolute right-10 top-[3px] z-10 flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--linear-border)] bg-[#030304]/90 px-2.5 text-[11px] font-[510] text-[var(--chat-text-secondary)] shadow-[var(--shadow-dialog)] backdrop-blur-md transition-colors hover:bg-[#08080a] hover:text-[var(--foreground)]">
          {viewLabel(view)}
          <ChevronDownIcon className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-32 border border-[var(--linear-border)] bg-[#050506] text-[var(--foreground)]"
        >
          {availableViews.map((value) => (
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
    </div>
  );
}

export function InspectorPanel({
  aiDetectionReport,
  data,
  error,
  loading,
  onViewChange,
  selectedStudentId,
  similarityReport,
  view,
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
  const availableViews = useMemo<InspectorView[]>(() => {
    const views: InspectorView[] = [];
    if (hasStudents) {
      views.push("source", "tests");
    }
    if (similarityReport) {
      views.push("similarity");
    }
    if (aiDetectionReport) {
      views.push("aiDetection");
    }
    return views;
  }, [aiDetectionReport, hasStudents, similarityReport]);

  useEffect(() => {
    if (availableViews.length === 0 || availableViews.includes(view)) {
      return;
    }
    onViewChange(availableViews[0]);
  }, [availableViews, onViewChange, view]);

  function revealSourceLine(line: number) {
    onViewChange("source");
    setHighlightedLine(line);
  }

  function renderView() {
    if (view === "similarity") {
      return <ReportSection kind="similarity" report={similarityReport} />;
    }
    if (view === "aiDetection") {
      return <ReportSection kind="aiDetection" report={aiDetectionReport} />;
    }
    if (!selectedStudent) {
      return null;
    }
    return view === "source" ? (
      <SourceSection
        highlightedLine={highlightedLine}
        student={selectedStudent}
      />
    ) : (
      <TestsSection student={selectedStudent} />
    );
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
      ) : availableViews.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[13px] text-[var(--chat-text-muted)]">
          No inspector results yet
        </div>
      ) : (
        <>
          <InspectorControls
            availableViews={availableViews}
            setView={onViewChange}
            view={view}
          />

          <div
            className={
              view === "source" || view === "tests"
                ? "min-h-0 flex-1 pb-14 pt-0"
                : "min-h-0 flex-1 pt-0"
            }
          >
            {renderView()}
          </div>

          {selectedStudent && (view === "source" || view === "tests") ? (
            <div className="absolute inset-x-0 bottom-0 z-10">
              <StatusDrawer
                onRevealLine={revealSourceLine}
                student={selectedStudent}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
