"use client";

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useState } from "react";

import type { StudentInspectorRow } from "@/components/chat/support/types";
import { cn } from "@/lib/utils";

type DrawerTab = "compile" | "banned";
type ReviewState = "compile" | "banned" | "clean";

function normalizedStatus(student: StudentInspectorRow) {
  return student.status?.toLowerCase().trim() ?? "";
}

function isCompileIssue(student: StudentInspectorRow) {
  const status = normalizedStatus(student);
  return (
    student.compileOk === false ||
    Boolean(student.compilerError) ||
    status.includes("fail") ||
    status.includes("error") ||
    status.includes("timed")
  );
}

function reviewState(student: StudentInspectorRow): ReviewState {
  if (isCompileIssue(student)) {
    return "compile";
  }
  if ((student.bannedCount ?? student.bannedHits.length) > 0) {
    return "banned";
  }
  return "clean";
}

function initialDrawerTab(student: StudentInspectorRow): DrawerTab {
  return reviewState(student) === "banned" ? "banned" : "compile";
}

function tabTone(tab: DrawerTab, active: boolean, student: StudentInspectorRow) {
  const hasCompileIssue = isCompileIssue(student);
  const hasBannedHits = student.bannedHits.length > 0;
  if (tab === "compile" && hasCompileIssue) {
    return active
      ? "border-[var(--linear-danger)]/35 bg-[var(--linear-danger)]/14 text-[var(--linear-danger)]"
      : "border-[var(--linear-danger)]/20 bg-[var(--linear-danger)]/8 text-[var(--linear-danger)] hover:border-[var(--linear-danger)]/30 hover:bg-[var(--linear-danger)]/12";
  }
  if (tab === "banned" && hasBannedHits) {
    return active
      ? "border-orange-400/35 bg-orange-400/14 text-orange-300"
      : "border-orange-400/20 bg-orange-400/8 text-orange-300 hover:border-orange-400/30 hover:bg-orange-400/12";
  }
  return active
    ? "border-[var(--linear-border)] bg-white/[0.06] text-[var(--foreground)]"
    : "border-[var(--linear-border-subtle)] bg-white/[0.02] text-[var(--chat-text-muted)] hover:border-[var(--linear-border)] hover:bg-white/[0.05] hover:text-[var(--foreground)]";
}

function locationLabel(hit: StudentInspectorRow["bannedHits"][number]) {
  const file = hit.file ?? "unknown file";
  const line = hit.line === null ? "" : `:${hit.line}`;
  const column = hit.column === null ? "" : `:${hit.column}`;
  return `${file}${line}${column}`;
}

function CompileTab({ student }: { student: StudentInspectorRow }) {
  if (!student.compilerError) {
    return (
      <p className="text-[12px] leading-relaxed text-[var(--chat-text-secondary)]">
        No compiler errors were reported.
      </p>
    );
  }

  return (
    <pre className="overflow-auto rounded-md border border-[var(--linear-danger)]/25 bg-[var(--linear-danger)]/10 p-2.5 font-mono text-[11.5px] leading-relaxed text-[var(--foreground)]">
      {student.compilerError}
    </pre>
  );
}

function BannedTab({
  onRevealLine,
  student,
}: {
  onRevealLine: (line: number) => void;
  student: StudentInspectorRow;
}) {
  if (student.bannedHits.length === 0) {
    return (
      <p className="text-[12px] leading-relaxed text-[var(--chat-text-secondary)]">
        No banned functions were reported.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {student.bannedHits.map((hit, index) => (
        <button
          className="flex w-full items-start justify-between gap-3 rounded-md border border-[var(--linear-border-subtle)] bg-transparent px-2.5 py-2 text-left transition-colors hover:border-orange-400/25 hover:bg-orange-400/8"
          key={`${hit.functionName}-${hit.file}-${hit.line}-${index}`}
          onClick={() => {
            if (hit.line !== null) {
              onRevealLine(hit.line);
            }
          }}
          type="button"
        >
          <span className="min-w-0">
            <span className="block truncate font-mono text-[12px] text-[var(--foreground)]">
              {hit.functionName}
            </span>
            {hit.snippet ? (
              <span className="mt-1 block truncate font-mono text-[11px] text-[var(--chat-text-muted)]">
                {hit.snippet}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 font-mono text-[10.5px] text-orange-300">
            {locationLabel(hit)}
          </span>
        </button>
      ))}
    </div>
  );
}

export function StatusDrawer({
  onRevealLine,
  student,
}: {
  onRevealLine: (line: number) => void;
  student: StudentInspectorRow;
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>(() =>
    initialDrawerTab(student),
  );

  return (
    <div className="pointer-events-auto rounded-t-xl border border-b-0 border-[var(--linear-border)] bg-[#030304]/98 shadow-[0_-18px_44px_rgba(0,0,0,0.42)] backdrop-blur-md">
      <div
        aria-expanded={open}
        className="group flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {(["compile", "banned"] as DrawerTab[]).map((tab) => (
            <button
              className={cn(
                "h-7 rounded-md border px-2.5 text-[11px] font-[510] capitalize transition-colors",
                tabTone(tab, activeTab === tab, student),
              )}
              key={tab}
              onClick={(event) => {
                event.stopPropagation();
                setActiveTab(tab);
                setOpen(true);
              }}
              type="button"
            >
              {tab === "compile" ? "Compile" : tab}
            </button>
          ))}
        </div>
        <span className="inline-flex items-center text-[var(--chat-text-muted)] transition-colors group-hover:text-[var(--foreground)]">
          {open ? (
            <ChevronDownIcon className="size-3.5" />
          ) : (
            <ChevronUpIcon className="size-3.5" />
          )}
        </span>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="h-72 overflow-auto border-t border-[var(--linear-border-subtle)] px-4 py-3">
            {activeTab === "compile" ? <CompileTab student={student} /> : null}
            {activeTab === "banned" ? (
              <BannedTab onRevealLine={onRevealLine} student={student} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
