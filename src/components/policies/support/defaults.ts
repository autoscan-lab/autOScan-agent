import type {
  PolicyAssignment,
  PolicyEditorDocument,
  PolicyGlobalsDocument,
  PolicyTestCase,
} from "@/lib/policies/types";

export function blankPolicy(
  assignment: PolicyAssignment,
): PolicyEditorDocument {
  return {
    compile: {
      flags: ["-Wall", "-Wextra"],
      gcc: "gcc",
      sourceFile: "main.c",
    },
    libraryFiles: [],
    name: assignment,
    testFiles: [],
    tests: [],
  };
}

export function blankTest(index: number): PolicyTestCase {
  return {
    args: [],
    expectedExit: 0,
    expectedOutput: "",
    expectedOutputFile: null,
    input: "",
    name: `Test ${index + 1}`,
  };
}

export function emptyGlobals(): PolicyGlobalsDocument {
  return {
    aiDictionary: { entries: [] },
    bannedFunctions: { banned: [] },
  };
}
