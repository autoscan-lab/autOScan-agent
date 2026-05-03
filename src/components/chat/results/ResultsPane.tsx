"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type {
  DetailSelection,
  GradingRunResponse,
  StudentResultRow,
  ToolReport,
} from "@/components/chat/shared/types";
import { AIDetectionTable } from "@/components/chat/results/tables/ai-detection/AIDetectionTable";
import { GradingTable } from "@/components/chat/results/tables/grading/GradingTable";
import { SimilarityTable } from "@/components/chat/results/tables/similarity/SimilarityTable";

export type LayoutState = "empty" | "active" | "results";

type ResultsTab = "grading" | "similarity" | "aiDetection";

const columnTemplate =
  "minmax(10rem,1.7fr) minmax(6rem,0.8fr) minmax(6rem,0.8fr) minmax(6rem,0.8fr) minmax(10rem,1.4fr)";
const columnHeaders = ["Student", "Compiles", "Tests", "Grade", "Feedback"];
const resultTabs: Array<{ id: ResultsTab; label: string }> = [
  { id: "grading", label: "Grading" },
  { id: "similarity", label: "Similarity" },
  { id: "aiDetection", label: "AI Detection" },
];

function GhostRow() {
  return (
    <div
      className="grid border-b border-[var(--linear-border-subtle)] last:border-b-0"
      style={{ gridTemplateColumns: columnTemplate }}
    >
      {[60, 30, 30, 25, 48].map((width, i) => (
        <div className="px-4 py-3" key={i}>
          <div
            className="h-2.5 animate-pulse rounded bg-white/[0.04]"
            style={{ width: `${width}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-4 pt-8 md:px-10">
      <div className="mb-3 h-2.5 w-28 animate-pulse rounded bg-white/[0.04]" />
      <div className="overflow-hidden rounded-lg bg-[var(--linear-panel)]/40">
        <div
          className="grid border-b border-[var(--linear-border-subtle)] bg-[var(--linear-ghost)]/50 font-mono text-[10px] uppercase tracking-[0.08em]"
          style={{ gridTemplateColumns: columnTemplate }}
        >
          {columnHeaders.map((header) => (
            <div className="px-4 py-2.5 font-[510] text-[var(--chat-text-muted)]/40" key={header}>
              {header}
            </div>
          ))}
        </div>
        {[...Array(6)].map((_, i) => (
          <GhostRow key={i} />
        ))}
      </div>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-md px-3 text-[12px] font-[510] transition-colors",
        active
          ? "bg-[var(--linear-ghost)] text-[var(--foreground)]"
          : "text-[var(--chat-text-muted)] hover:bg-[var(--linear-ghost)]/50 hover:text-[var(--foreground)]",
      )}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {children}
    </button>
  );
}

function NotRunHint({ tool }: { tool: "similarity" | "AI detection" }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--linear-border-subtle)] px-6 py-12 text-center">
      <p className="text-[13px] font-[510] text-[var(--foreground)]">
        <span>{tool}</span>
        <span className="ml-1">hasn&apos;t been run yet</span>
      </p>
      <p className="mt-1 text-[12px] text-[var(--chat-text-muted)]">
        Ask the agent to {tool === "similarity" ? "check for similarity" : "run AI detection"} to populate this view.
      </p>
    </div>
  );
}

export function ResultsPane({
  aiDetectionReport,
  detailSelection,
  layoutState,
  onSelectDetail,
  panelData,
  panelError,
  panelLoading,
  similarityReport,
}: {
  aiDetectionReport: ToolReport | null;
  detailSelection: DetailSelection;
  layoutState: LayoutState;
  onSelectDetail: (selection: Exclude<DetailSelection, null>) => void;
  panelData: GradingRunResponse | null;
  panelError: string | null;
  panelLoading: boolean;
  similarityReport: ToolReport | null;
}) {
  const students = useMemo<StudentResultRow[]>(
    () => panelData?.students ?? [],
    [panelData?.students],
  );
  const selectedStudentId = detailSelection?.kind === "student"
    ? detailSelection.id
    : null;
  const selectedSimilarityPairId = detailSelection?.kind === "similarity"
    ? detailSelection.id
    : null;
  const selectedAiDetectionId = detailSelection?.kind === "aiDetection"
    ? detailSelection.id
    : null;

  const [tab, setTab] = useState<ResultsTab>("grading");

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div className="no-scrollbar h-full overflow-y-auto">
        {layoutState === "empty" ? (
          <EmptyState />
        ) : panelError ? (
          <div className="flex h-full items-center justify-center px-8">
            <p className="text-[13px] text-[var(--linear-danger)]">{panelError}</p>
          </div>
        ) : panelLoading && !panelData ? (
          <EmptyState />
        ) : panelData ? (
          <div className="flex h-full flex-col">
            {/* Tab bar */}
            <div className="sticky top-0 z-10 bg-[var(--chat-bg)] px-4 pb-3 pt-8 md:px-10">
              <div className="flex items-center gap-1" role="tablist">
                {resultTabs.map((item) => (
                  <TabButton
                    active={tab === item.id}
                    key={item.id}
                    onClick={() => setTab(item.id)}
                  >
                    {item.label}
                  </TabButton>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="px-4 pb-8 md:px-10">
              {tab === "grading" ? (
                <GradingTable
                  selectedStudentId={selectedStudentId}
                  setSelectedStudentId={(id) => {
                    if (id) onSelectDetail({ id, kind: "student" });
                  }}
                  students={students}
                />
              ) : tab === "similarity" ? (
                similarityReport ? (
                  <SimilarityTable
                    onRowSelect={(pair) => {
                      onSelectDetail({ id: pair.id, kind: "similarity" });
                    }}
                    report={similarityReport}
                    selectedId={selectedSimilarityPairId}
                  />
                ) : (
                  <NotRunHint tool="similarity" />
                )
              ) : aiDetectionReport ? (
                <AIDetectionTable
                  onRowSelect={(submission) => {
                    onSelectDetail({ id: submission.id, kind: "aiDetection" });
                  }}
                  report={aiDetectionReport}
                  selectedId={selectedAiDetectionId}
                />
              ) : (
                <NotRunHint tool="AI detection" />
              )}
            </div>
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
