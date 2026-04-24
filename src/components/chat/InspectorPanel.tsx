"use client";

import { RefreshCwIcon } from "lucide-react";
import { useMemo } from "react";

import type { GradingRunResponse } from "./support/types";
import {
  BannedHitsSection,
  CompileSection,
  MetricsGrid,
  NotesSection,
  SourceSection,
  StudentHeader,
  TestsSection,
} from "./inspector/InspectorSections";

export type InspectorPanelProps = {
  data: GradingRunResponse | null;
  error: string | null;
  loading: boolean;
  selectedStudentId: string | null;
};

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error ? (
        <div className="mx-6 mt-5 rounded-md border border-[var(--linear-danger)]/35 bg-[var(--linear-danger)]/10 px-3 py-2 text-sm text-[var(--linear-danger)]">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--chat-text-muted)]">
          <RefreshCwIcon className="mr-2 size-4 animate-spin" />
          Loading...
        </div>
      ) : !hasStudents ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[13px] text-[var(--chat-text-muted)]">
          No grading results yet
        </div>
      ) : selectedStudent ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            <StudentHeader student={selectedStudent} />
            <MetricsGrid student={selectedStudent} />
            <CompileSection student={selectedStudent} />
            <BannedHitsSection student={selectedStudent} />
            <NotesSection student={selectedStudent} />
            <SourceSection student={selectedStudent} />
            <TestsSection student={selectedStudent} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
