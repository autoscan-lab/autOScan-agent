"use client";

import {
  ChevronLeftIcon,
  FlaskConicalIcon,
  PlusIcon,
  ShieldOffIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  PolicyAssignment,
  PolicyEditorDocument,
  PolicyGlobalsDocument,
} from "@/lib/policies/types";
import { policyAssignments } from "@/lib/policies/types";
import { cn } from "@/lib/utils";
import { PolicyEditor } from "./editor/PolicyEditor";
import { AIDictionaryPanel, BannedFunctionsPanel } from "./globals/GlobalPanel";
import { fetchJson } from "./support/api";
import { blankPolicy, emptyGlobals } from "./support/defaults";
import type { PolicyResponse, SaveState } from "./support/types";

type PolicyNavItem = PolicyAssignment | "banned" | "ai";

function AssignmentRail({
  selected,
  setSelected,
}: {
  selected: PolicyNavItem;
  setSelected: (item: PolicyNavItem) => void;
}) {
  return (
    <nav className="pt-1">
      <div className="mb-1 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-[var(--chat-text-muted)]">
        Assignments
      </div>
      <div className="space-y-0.5">
        {policyAssignments.map((assignment) => (
          <button
            className={cn(
              "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] transition-colors",
              selected === assignment
                ? "bg-white/[0.07] text-[var(--foreground)]"
                : "text-[var(--chat-text-muted)] hover:bg-white/[0.04] hover:text-[var(--chat-text-secondary)]",
            )}
            key={assignment}
            onClick={() => setSelected(assignment)}
            type="button"
          >
            <FlaskConicalIcon className="size-3.5 shrink-0 opacity-60" />
            {assignment}
          </button>
        ))}
      </div>
      <div className="mb-1 mt-5 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-[var(--chat-text-muted)]">
        Settings
      </div>
      <div className="space-y-0.5">
        <button
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] transition-colors",
            selected === "banned"
              ? "bg-white/[0.07] text-[var(--foreground)]"
              : "text-[var(--chat-text-muted)] hover:bg-white/[0.04] hover:text-[var(--chat-text-secondary)]",
          )}
          onClick={() => setSelected("banned")}
          type="button"
        >
          <ShieldOffIcon className="size-3.5 shrink-0 opacity-60" />
          Banned
        </button>
        <button
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] transition-colors",
            selected === "ai"
              ? "bg-white/[0.07] text-[var(--foreground)]"
              : "text-[var(--chat-text-muted)] hover:bg-white/[0.04] hover:text-[var(--chat-text-secondary)]",
          )}
          onClick={() => setSelected("ai")}
          type="button"
        >
          <SparklesIcon className="size-3.5 shrink-0 opacity-60" />
          AI
        </button>
      </div>
    </nav>
  );
}

function CenteredState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      {children}
    </div>
  );
}

function normalizedPolicyForSave(
  assignment: PolicyAssignment,
  policy: PolicyEditorDocument,
): PolicyEditorDocument {
  return {
    ...policy,
    compile: {
      ...policy.compile,
      gcc: "gcc",
    },
    name: assignment,
  };
}

export function PolicyBuilder() {
  const [selected, setSelected] = useState<PolicyNavItem>("S0");
  const [policyResponse, setPolicyResponse] = useState<PolicyResponse | null>(
    null,
  );
  const [policyLoading, setPolicyLoading] = useState(true);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [policySaveState, setPolicySaveState] = useState<SaveState>("idle");
  const [globals, setGlobals] = useState<PolicyGlobalsDocument>(() =>
    emptyGlobals(),
  );
  const [globalsError, setGlobalsError] = useState<string | null>(null);
  const [globalsSaveState, setGlobalsSaveState] = useState<SaveState>("idle");

  const policy = policyResponse?.policy ?? null;

  useEffect(() => {
    if (selected === "banned" || selected === "ai") {
      return;
    }

    let cancelled = false;
    const assignment = selected;

    async function loadPolicy() {
      await Promise.resolve();
      if (cancelled) {
        return;
      }

      setPolicyLoading(true);
      setPolicyError(null);
      try {
        const payload = await fetchJson<PolicyResponse>(
          `/api/policies/${assignment}`,
        );
        if (!cancelled) {
          setPolicyResponse(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setPolicyError(
            error instanceof Error ? error.message : "Could not load policy.",
          );
        }
      } finally {
        if (!cancelled) {
          setPolicyLoading(false);
        }
      }
    }

    void loadPolicy();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    let cancelled = false;

    async function loadGlobals() {
      try {
        const payload =
          await fetchJson<PolicyGlobalsDocument>("/api/policies/globals");
        if (!cancelled) {
          setGlobals(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setGlobalsError(
            error instanceof Error
              ? error.message
              : "Could not load global config.",
          );
        }
      }
    }

    void loadGlobals();
    return () => {
      cancelled = true;
    };
  }, []);

  async function savePolicy(nextPolicy: PolicyEditorDocument | null = policy) {
    if (!nextPolicy || selected === "banned" || selected === "ai") {
      return;
    }
    const policyToSave = normalizedPolicyForSave(selected, nextPolicy);
    setPolicySaveState("saving");
    setPolicyError(null);
    try {
      const payload = await fetchJson<PolicyResponse>(
        `/api/policies/${selected}`,
        {
          body: JSON.stringify({ policy: policyToSave }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        },
      );
      setPolicyResponse(payload);
      setPolicySaveState("saved");
      window.setTimeout(() => setPolicySaveState("idle"), 1200);
    } catch (error) {
      setPolicySaveState("error");
      setPolicyError(
        error instanceof Error ? error.message : "Could not save policy.",
      );
    }
  }

  async function createPolicy() {
    if (selected === "banned" || selected === "ai") {
      return;
    }
    await savePolicy(blankPolicy(selected));
  }

  async function saveGlobals() {
    setGlobalsSaveState("saving");
    setGlobalsError(null);
    try {
      const payload = await fetchJson<PolicyGlobalsDocument>(
        "/api/policies/globals",
        {
          body: JSON.stringify(globals),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        },
      );
      setGlobals(payload);
      setGlobalsSaveState("saved");
      window.setTimeout(() => setGlobalsSaveState("idle"), 1200);
    } catch (error) {
      setGlobalsSaveState("error");
      setGlobalsError(
        error instanceof Error ? error.message : "Could not save global config.",
      );
    }
  }

  const pageTitle = useMemo(() => {
    if (selected === "banned") return "Banned functions";
    if (selected === "ai") return "AI dictionary";
    return selected;
  }, [selected]);

  function renderContent() {
    if (selected === "banned" || selected === "ai") {
      return (
        <div className="mx-auto w-full max-w-[800px] px-8 py-6">
          {globalsError ? (
            <p className="mb-4 text-[13px] text-[var(--linear-danger)]">
              {globalsError}
            </p>
          ) : null}
          {selected === "banned" ? (
            <BannedFunctionsPanel
              globals={globals}
              onChange={(bannedFunctions) =>
                setGlobals({ ...globals, bannedFunctions })
              }
              saveGlobals={() => void saveGlobals()}
              saveState={globalsSaveState}
            />
          ) : (
            <AIDictionaryPanel
              aiDictionary={globals.aiDictionary}
              onChange={(aiDictionary) =>
                setGlobals({ ...globals, aiDictionary })
              }
              saveGlobals={() => void saveGlobals()}
              saveState={globalsSaveState}
            />
          )}
        </div>
      );
    }

    if (policyError) {
      return (
        <CenteredState>
          <p className="text-[13px] text-[var(--linear-danger)]">{policyError}</p>
        </CenteredState>
      );
    }

    if (policyLoading) {
      return (
        <CenteredState>
          <p className="text-[13px] text-[var(--chat-text-muted)]">Loading...</p>
        </CenteredState>
      );
    }

    if (policy) {
      return (
        <div className="mx-auto w-full max-w-[800px] px-8 py-6">
          <PolicyEditor
            assignment={selected}
            onPolicyChange={(nextPolicy) =>
              setPolicyResponse({
                assignment: selected,
                exists: true,
                policy: nextPolicy,
              })
            }
            policy={policy}
            savePolicy={() => void savePolicy()}
            saveState={policySaveState}
          />
        </div>
      );
    }

    return (
      <CenteredState>
        <p className="text-[13px] text-[var(--chat-text-muted)]">
          No policy configured for {selected}.
        </p>
        <Button
          className="h-7 rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-[12px] font-[510] text-[var(--foreground)] hover:bg-white/[0.07]"
          onClick={() => void createPolicy()}
          size="sm"
          type="button"
          variant="ghost"
        >
          <PlusIcon className="size-3.5" />
          Create policy
        </Button>
      </CenteredState>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[var(--linear-bg)] text-[var(--foreground)]">
      <header className="sticky top-0 z-20 shrink-0 bg-[#08090a]/90 backdrop-blur-md">
        <div className="flex h-12 items-center gap-3 px-4">
          <Link
            className="flex items-center gap-1 text-[var(--chat-text-muted)] transition-colors hover:text-[var(--foreground)]"
            href="/chat"
          >
            <ChevronLeftIcon className="size-3.5" />
            <span className="text-[12px]">Chat</span>
          </Link>
          <span className="text-[var(--chat-text-muted)]">/</span>
          <span className="text-[13px] font-[510] text-[var(--foreground)]">
            {pageTitle}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-40 shrink-0 overflow-y-auto px-2 pt-4">
          <AssignmentRail selected={selected} setSelected={setSelected} />
        </aside>

        <div className="mb-2 mr-2 mt-2 flex min-h-0 flex-1 flex-col rounded-xl border border-white/[0.04] bg-[var(--linear-panel)]">
          <div className="min-h-0 flex-1 overflow-y-auto">{renderContent()}</div>
        </div>
      </div>
    </main>
  );
}
