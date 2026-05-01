import { PlusIcon, XIcon } from "lucide-react";
import type { PolicyTestCase } from "@/lib/policies/types";
import { blankTest } from "../support/defaults";
import {
  StringListEditor,
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
  return (
    <div className="space-y-3">
      {tests.length === 0 ? (
        <p className="rounded-md border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-[13px] text-[var(--chat-text-muted)]">
          No tests configured.
        </p>
      ) : null}
      {tests.map((test, index) => (
        <div
          className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3"
          key={index}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[12px] text-[var(--chat-text-muted)]">
              Test {index + 1}
            </span>
            <button
              aria-label="Remove test"
              className="inline-flex size-7 items-center justify-center rounded-md border border-white/[0.05] bg-white/[0.02] text-[var(--chat-text-muted)] transition-colors hover:border-white/[0.08] hover:bg-white/[0.05] hover:text-[var(--linear-danger)]"
              onClick={() =>
                onChange(tests.filter((_, itemIndex) => itemIndex !== index))
              }
              type="button"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label="Name"
              onChange={(value) => {
                const next = [...tests];
                next[index] = { ...test, name: value };
                onChange(next);
              }}
              value={test.name}
            />
            <TextField
              label="Expected exit"
              onChange={(value) => {
                const parsed = Number.parseInt(value, 10);
                const next = [...tests];
                next[index] = {
                  ...test,
                  expectedExit: Number.isFinite(parsed) ? parsed : null,
                };
                onChange(next);
              }}
              placeholder="0"
              value={test.expectedExit === null ? "" : String(test.expectedExit)}
            />
          </div>
          <div className="mt-3">
            <StringListEditor
              addLabel="Add arg"
              itemPlaceholder="argument"
              label="Args"
              onChange={(args) => {
                const next = [...tests];
                next[index] = { ...test, args };
                onChange(next);
              }}
              values={test.args}
            />
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <TextAreaField
              label="Input"
              onChange={(input) => {
                const next = [...tests];
                next[index] = { ...test, input };
                onChange(next);
              }}
              placeholder="stdin"
              rows={5}
              value={test.input}
            />
            <TextAreaField
              label="Expected output"
              onChange={(expectedOutput) => {
                const next = [...tests];
                next[index] = { ...test, expectedOutput };
                onChange(next);
              }}
              placeholder="stdout"
              rows={5}
              value={test.expectedOutput}
            />
          </div>
        </div>
      ))}
      <button
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.05] bg-white/[0.02] px-3 text-[12px] font-[510] text-[var(--chat-text-secondary)] transition-colors hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-[var(--foreground)]"
        onClick={() => onChange([...tests, blankTest(tests.length)])}
        type="button"
      >
        <PlusIcon className="size-3" />
        Add test
      </button>
    </div>
  );
}
