"use client";

import { useState } from "react";
import type {
  AIDictionaryDocument,
  BannedFunctionsDocument,
  PolicyGlobalsDocument,
} from "@/lib/policies/types";
import { cn } from "@/lib/utils";
import type { SaveState } from "../support/types";
import {
  fieldClass,
  SaveButton,
  TextAreaField,
  TextField,
} from "../shared/form-controls";
import { PlusIcon } from "lucide-react";

export function BannedFunctionsPanel({
  globals,
  onChange,
  saveGlobals,
  saveState,
}: {
  globals: PolicyGlobalsDocument;
  onChange: (bannedFunctions: BannedFunctionsDocument) => void;
  saveGlobals: () => void;
  saveState: SaveState;
}) {
  const banned = globals.bannedFunctions.banned;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-[510] tracking-[-0.012em] text-[var(--foreground)]">
            Banned functions
          </h1>
          <p className="mt-0.5 text-[12px] text-[var(--chat-text-muted)]">
            Functions blocked during grading.
          </p>
        </div>
        <SaveButton onClick={saveGlobals} state={saveState}>
          Save
        </SaveButton>
      </div>

      <div className="rounded-xl border border-white/[0.04] bg-[var(--linear-surface)]">
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <span className="text-[13px] font-[510] text-[var(--foreground)]">Functions</span>
          <button
            className="inline-flex h-7 items-center rounded-md border border-white/[0.05] bg-white/[0.02] px-2.5 text-[12px] font-[510] text-[var(--chat-text-secondary)] transition-colors hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-[var(--foreground)]"
            onClick={() => onChange({ banned: [...banned, ""] })}
            type="button"
          >
            Add function
          </button>
        </div>
        <div className="border-t border-white/[0.03] px-6 py-4">
          {banned.length === 0 ? (
            <p className="text-[13px] text-[var(--chat-text-muted)]">
              No banned functions configured.
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {banned.map((value, index) => (
                <div className="relative" key={index}>
                  <input
                    className={fieldClass("h-8 w-full rounded-lg px-2.5 pr-7 py-1 outline-none transition-colors")}
                    onChange={(event) => {
                      const next = [...banned];
                      next[index] = event.target.value;
                      onChange({ banned: next });
                    }}
                    placeholder="system"
                    value={value}
                  />
                  <button
                    aria-label="Remove"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex size-5 items-center justify-center rounded text-[var(--chat-text-muted)] transition-colors hover:text-[var(--linear-danger)]"
                    onClick={() =>
                      onChange({
                        banned: banned.filter((_, itemIndex) => itemIndex !== index),
                      })
                    }
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AIDictionaryPanel({
  aiDictionary,
  onChange,
  saveGlobals,
  saveState,
}: {
  aiDictionary: AIDictionaryDocument;
  onChange: (aiDictionary: AIDictionaryDocument) => void;
  saveGlobals: () => void;
  saveState: SaveState;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const entries = aiDictionary.entries;
  const activeIndex = Math.min(selectedIndex, Math.max(0, entries.length - 1));
  const activeEntry = entries[activeIndex];

  function addPattern() {
    const newIndex = entries.length;
    onChange({ entries: [...entries, { category: "", code: "", id: "", title: "" }] });
    setSelectedIndex(newIndex);
  }

  function removePattern() {
    const next = entries.filter((_, i) => i !== activeIndex);
    onChange({ entries: next });
    setSelectedIndex(Math.max(0, activeIndex - 1));
  }

  function updateEntry(patch: Partial<typeof activeEntry>) {
    const next = [...entries];
    next[activeIndex] = { ...activeEntry, ...patch };
    onChange({ entries: next });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-[510] tracking-[-0.012em] text-[var(--foreground)]">
            AI dictionary
          </h1>
          <p className="mt-0.5 text-[12px] text-[var(--chat-text-muted)]">
            Code patterns used to detect AI-generated submissions.
          </p>
        </div>
        <SaveButton onClick={saveGlobals} state={saveState}>
          Save
        </SaveButton>
      </div>

      <div className="rounded-xl border border-white/[0.04] bg-[var(--linear-surface)]">
        {/* Tab bar */}
        <div className="flex items-center gap-0.5 overflow-x-auto border-b border-white/[0.03] px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {entries.map((entry, index) => (
            <button
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-[12px] font-[510] transition-colors whitespace-nowrap",
                index === activeIndex
                  ? "bg-white/[0.07] text-[var(--foreground)]"
                  : "text-[var(--chat-text-muted)] hover:bg-white/[0.04] hover:text-[var(--chat-text-secondary)]",
              )}
              key={index}
              onClick={() => setSelectedIndex(index)}
              type="button"
            >
              {entry.title || `Pattern ${index + 1}`}
            </button>
          ))}
          <button
            aria-label="Add pattern"
            className="ml-1 flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--chat-text-muted)] transition-colors hover:bg-white/[0.04] hover:text-[var(--foreground)]"
            onClick={addPattern}
            type="button"
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>

        {/* Pattern content */}
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <p className="text-[13px] text-[var(--chat-text-muted)]">
              No AI patterns configured.
            </p>
            <button
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.05] bg-white/[0.02] px-2.5 text-[12px] font-[510] text-[var(--chat-text-secondary)] transition-colors hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-[var(--foreground)]"
              onClick={addPattern}
              type="button"
            >
              <PlusIcon className="size-3" />
              Add pattern
            </button>
          </div>
        ) : (
          <div className="px-6 py-5">
            <div className="mb-4 flex justify-end">
              <button
                className="inline-flex h-7 items-center justify-center rounded-md border border-[var(--linear-danger)]/25 bg-[var(--linear-danger)]/10 px-2.5 text-[12px] font-[510] text-[var(--linear-danger)] transition-colors hover:bg-[var(--linear-danger)]/15"
                onClick={removePattern}
                type="button"
              >
                Remove
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label="Title"
                onChange={(title) => updateEntry({ title })}
                value={activeEntry.title}
              />
              <TextField
                label="Category"
                onChange={(category) => updateEntry({ category })}
                value={activeEntry.category}
              />
            </div>
            <div className="mt-3">
              <TextAreaField
                label="Code"
                onChange={(code) => updateEntry({ code })}
                rows={10}
                value={activeEntry.code}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
