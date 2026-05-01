import type {
  PolicyAssignment,
  PolicyEditorDocument,
} from "@/lib/policies/types";

export type PolicyResponse = {
  assignment: PolicyAssignment;
  exists: boolean;
  policy: PolicyEditorDocument | null;
};

export type SaveState = "idle" | "saving" | "saved" | "error";
