import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PolicyTestCase } from "@/lib/policies/types";
import { blankTest } from "../support/defaults";
import {
  TextAreaField,
  TextField,
} from "../shared/form-controls";

export function TestsEditor({
  onChange,
  tests,
}: {
  onChange: (tests: PolicyTestCase[]) => void;
  tests: PolicyTestCase[];
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const activeIndex = Math.min(selectedIndex, Math.max(0, tests.length - 1));
  const activeTest = tests[activeIndex];

  function flagsValue(args: string[]) {
    return args.join(" ");
  }

  function parseArgs(value: string) {
    return value
      .split(/\s+/)
      .map((arg) => arg.trim())
      .filter(Boolean);
  }

  function addTest() {
    const newIndex = tests.length;
    onChange([...tests, blankTest(tests.length)]);
    setSelectedIndex(newIndex);
  }

  function removeTest() {
    const next = tests.filter((_, index) => index !== activeIndex);
    onChange(next);
    setSelectedIndex(Math.max(0, activeIndex - 1));
  }

  function updateActiveTest(patch: Partial<PolicyTestCase>) {
    const next = [...tests];
    next[activeIndex] = { ...activeTest, ...patch };
    onChange(next);
  }

  return (
    <div className="rounded-xl border border-white/[0.04] bg-[var(--linear-surface)]">
      <div className="flex items-center gap-0.5 overflow-x-auto border-b border-white/[0.03] px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tests.map((test, index) => (
          <button
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-[12px] font-[510] whitespace-nowrap transition-colors",
              index === activeIndex
                ? "bg-white/[0.07] text-[var(--foreground)]"
                : "text-[var(--chat-text-muted)] hover:bg-white/[0.04] hover:text-[var(--chat-text-secondary)]",
            )}
            key={index}
            onClick={() => setSelectedIndex(index)}
            type="button"
          >
            {test.name || "Untitled test"}
          </button>
        ))}
        <button
          aria-label="Add test"
          className="ml-1 flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--chat-text-muted)] transition-colors hover:bg-white/[0.04] hover:text-[var(--foreground)]"
          onClick={addTest}
          type="button"
        >
          <PlusIcon className="size-3.5" />
        </button>
      </div>

      {tests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="text-[13px] text-[var(--chat-text-muted)]">
            No tests configured.
          </p>
          <button
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.05] bg-white/[0.02] px-2.5 text-[12px] font-[510] text-[var(--chat-text-secondary)] transition-colors hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-[var(--foreground)]"
            onClick={addTest}
            type="button"
          >
            <PlusIcon className="size-3" />
            Add test
          </button>
        </div>
      ) : (
        <div className="px-6 py-5">
          <div className="mb-4 flex justify-end">
            <button
              className="inline-flex h-7 items-center justify-center rounded-md border border-[var(--linear-danger)]/25 bg-[var(--linear-danger)]/10 px-2.5 text-[12px] font-[510] text-[var(--linear-danger)] transition-colors hover:bg-[var(--linear-danger)]/15"
              onClick={removeTest}
              type="button"
            >
              Remove
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label="Name"
              onChange={(name) => updateActiveTest({ name })}
              value={activeTest.name}
            />
            <TextField
              label="Expected exit"
              onChange={(value) => {
                const parsed = Number.parseInt(value, 10);
                updateActiveTest({
                  expectedExit: Number.isFinite(parsed) ? parsed : null,
                });
              }}
              placeholder="0"
              value={
                activeTest.expectedExit === null
                  ? ""
                  : String(activeTest.expectedExit)
              }
            />
          </div>
          <div className="mt-3">
            <TextField
              label="Args"
              onChange={(value) => updateActiveTest({ args: parseArgs(value) })}
              placeholder="--verbose -Wall"
              value={flagsValue(activeTest.args)}
            />
          </div>
          <div className="mt-3 grid gap-3">
            <TextAreaField
              label="Input"
              onChange={(input) => updateActiveTest({ input })}
              placeholder="stdin"
              rows={5}
              value={activeTest.input}
            />
            <TextAreaField
              className="max-h-56 overflow-y-auto resize-none"
              label="Expected output"
              onChange={(expectedOutput) => updateActiveTest({ expectedOutput })}
              placeholder="stdout"
              rows={5}
              value={activeTest.expectedOutput}
            />
          </div>
        </div>
      )}
    </div>
  );
}
