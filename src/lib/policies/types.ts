export const policyAssignments = [
  "S0",
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "S7",
  "S8",
  "S9",
] as const;

export type PolicyAssignment = (typeof policyAssignments)[number];

export type PolicyTestCase = {
  args: string[];
  expectedExit: number | null;
  expectedOutput: string;
  expectedOutputFile: string | null;
  input: string;
  name: string;
};

export type PolicyEditorDocument = {
  compile: {
    flags: string[];
    gcc: string;
    sourceFile: string;
  };
  libraryFiles: string[];
  name: string;
  testFiles: string[];
  tests: PolicyTestCase[];
};

export type BannedFunctionsDocument = {
  banned: string[];
};

export type AIDictionaryEntry = {
  category: string;
  code: string;
  id: string;
  title: string;
};

export type AIDictionaryDocument = {
  entries: AIDictionaryEntry[];
};

export type PolicyGlobalsDocument = {
  aiDictionary: AIDictionaryDocument;
  bannedFunctions: BannedFunctionsDocument;
};
