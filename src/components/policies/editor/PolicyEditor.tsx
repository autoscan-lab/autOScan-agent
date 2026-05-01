import type {
  PolicyAssignment,
  PolicyEditorDocument,
} from "@/lib/policies/types";
import type { SaveState } from "../support/types";
import {
  fieldClass,
  labelClass,
  SaveButton,
  SectionShell,
  TextField,
} from "../shared/form-controls";
import { PolicyFileEditor } from "./PolicyFileEditor";
import { TestsEditor } from "./TestsEditor";

function flagsValue(flags: string[]) {
  return flags.join(" ");
}

function parseFlags(value: string) {
  return value.split(" ").map((flag) => flag.trim());
}

export function PolicyEditor({
  assignment,
  onPolicyChange,
  policy,
  savePolicy,
  saveState,
}: {
  assignment: PolicyAssignment;
  onPolicyChange: (policy: PolicyEditorDocument) => void;
  policy: PolicyEditorDocument;
  savePolicy: () => void;
  saveState: SaveState;
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-[510] tracking-[-0.012em] text-[var(--foreground)]">
            {assignment}
          </h1>
          <p className="mt-0.5 text-[12px] text-[var(--chat-text-muted)]">
            Assignment policy
          </p>
        </div>
        <SaveButton onClick={savePolicy} state={saveState}>
          Save policy
        </SaveButton>
      </div>

      <SectionShell
        description="Source file and gcc flags."
        title="Compile"
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)]">
          <TextField
            label="Source file"
            onChange={(sourceFile) =>
              onPolicyChange({
                ...policy,
                compile: { ...policy.compile, sourceFile },
              })
            }
            value={policy.compile.sourceFile}
          />
          <label className="block space-y-1.5">
            <span className={labelClass()}>Flags</span>
            <input
              className={fieldClass("h-8 w-full rounded-lg px-2.5 py-1 outline-none transition-colors")}
              onChange={(event) =>
                onPolicyChange({
                  ...policy,
                  compile: {
                    ...policy.compile,
                    flags: parseFlags(event.target.value),
                  },
                })
              }
              placeholder="-Wall -Wextra"
              value={flagsValue(policy.compile.flags)}
            />
          </label>
        </div>
      </SectionShell>

      <SectionShell
        description="Companion files for compilation and testing."
        title="Files"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <PolicyFileEditor
            assignment={assignment}
            fileKind="library"
            label="Library files"
            onChange={(libraryFiles) =>
              onPolicyChange({ ...policy, libraryFiles })
            }
            values={policy.libraryFiles}
          />
          <PolicyFileEditor
            assignment={assignment}
            fileKind="test"
            label="Test files"
            onChange={(testFiles) => onPolicyChange({ ...policy, testFiles })}
            values={policy.testFiles}
          />
        </div>
      </SectionShell>

      <SectionShell
        description="Expected inputs and outputs for grading."
        title="Tests"
      >
        <TestsEditor
          onChange={(tests) => onPolicyChange({ ...policy, tests })}
          tests={policy.tests}
        />
      </SectionShell>
    </div>
  );
}
