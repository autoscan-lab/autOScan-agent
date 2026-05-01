import YAML from "yaml";

import type {
  AIDictionaryDocument,
  AIDictionaryEntry,
  BannedFunctionsDocument,
  PolicyEditorDocument,
  PolicyTestCase,
} from "./types";

type RawPolicy = {
  compile?: {
    flags?: unknown;
    gcc?: unknown;
    source_file?: unknown;
  };
  library_files?: unknown;
  name?: unknown;
  run?: {
    test_cases?: unknown;
  };
  test_files?: unknown;
};

type RawTestCase = {
  args?: unknown;
  expected_exit?: unknown;
  expected_output_file?: unknown;
  input?: unknown;
  name?: unknown;
};

type RawAIDictionary = {
  entries?: unknown;
};

type RawAIEntry = {
  category?: unknown;
  code?: unknown;
  id?: unknown;
  title?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOf(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseYamlRecord(value: string): Record<string, unknown> {
  const parsed = YAML.parse(value);
  return isRecord(parsed) ? parsed : {};
}

export function expectedOutputKey(assignment: string, filename: string) {
  return `assignments/${assignment}/expected_outputs/${filename}`;
}

export function policyKey(assignment: string) {
  return `assignments/${assignment}/policy.yml`;
}

export function aiDictionaryKey() {
  return "ai_dictionary.yaml";
}

export function bannedFunctionsKey() {
  return "banned.yaml";
}

export function slugify(value: string, fallback: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

export function uniqueAIEntryId(entry: AIDictionaryEntry, index: number) {
  return entry.id.trim() || slugify(entry.title, `entry-${index + 1}`);
}

export function parsePolicy(
  policyYaml: string,
  expectedOutputs: Record<string, string>,
): PolicyEditorDocument {
  const raw = parseYamlRecord(policyYaml) as RawPolicy;
  const testCases = Array.isArray(raw.run?.test_cases)
    ? raw.run.test_cases
    : [];

  return {
    compile: {
      flags: stringArray(raw.compile?.flags),
      gcc: stringOf(raw.compile?.gcc, "gcc"),
      sourceFile: stringOf(raw.compile?.source_file),
    },
    libraryFiles: stringArray(raw.library_files),
    name: stringOf(raw.name),
    testFiles: stringArray(raw.test_files),
    tests: testCases.map((value, index): PolicyTestCase => {
      const test = (isRecord(value) ? value : {}) as RawTestCase;
      const expectedOutputFile = stringOf(test.expected_output_file);
      return {
        args: stringArray(test.args),
        expectedExit: numberOrNull(test.expected_exit),
        expectedOutput: expectedOutputFile
          ? (expectedOutputs[expectedOutputFile] ?? "")
          : "",
        expectedOutputFile: expectedOutputFile || null,
        input: stringOf(test.input),
        name: stringOf(test.name, `Test ${index + 1}`),
      };
    }),
  };
}

export function stringifyPolicy(
  assignment: string,
  policy: PolicyEditorDocument,
) {
  const usedFiles = new Set<string>();
  const expectedOutputs: Record<string, string> = {};

  const raw = {
    name: policy.name.trim(),
    compile: {
      gcc: policy.compile.gcc.trim() || "gcc",
      flags: policy.compile.flags.map((flag) => flag.trim()).filter(Boolean),
      source_file: policy.compile.sourceFile.trim(),
    },
    library_files: policy.libraryFiles
      .map((file) => file.trim())
      .filter(Boolean),
    test_files: policy.testFiles.map((file) => file.trim()).filter(Boolean),
    run: {
      test_cases: policy.tests.map((test, index) => {
        const rawTest: Record<string, unknown> = {
          name: test.name.trim() || `Test ${index + 1}`,
          args: test.args.map((arg) => arg.trim()).filter(Boolean),
          input: test.input,
        };

        if (test.expectedExit !== null) {
          rawTest.expected_exit = test.expectedExit;
        }

        const output = test.expectedOutput;
        if (output.trim()) {
          const baseFile =
            test.expectedOutputFile ??
            `${slugify(test.name, `test-${index + 1}`)}.txt`;
          let filename = baseFile;
          let suffix = 2;
          while (usedFiles.has(filename)) {
            filename = baseFile.replace(/(\.[^.]+)?$/, `-${suffix}$1`);
            suffix += 1;
          }
          usedFiles.add(filename);
          rawTest.expected_output_file = filename;
          expectedOutputs[expectedOutputKey(assignment, filename)] = output;
        }

        return rawTest;
      }),
    },
  };

  return {
    expectedOutputs,
    policyYaml: YAML.stringify(raw, { lineWidth: 0 }),
  };
}

export function defaultPolicy(assignment: string): PolicyEditorDocument {
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

export function parseBannedFunctions(
  yaml: string | undefined,
): BannedFunctionsDocument {
  const raw = yaml ? parseYamlRecord(yaml) : {};
  return { banned: stringArray(raw.banned) };
}

export function stringifyBannedFunctions(value: BannedFunctionsDocument) {
  return YAML.stringify(
    {
      banned: value.banned.map((item) => item.trim()).filter(Boolean),
    },
    { lineWidth: 0 },
  );
}

export function parseAIDictionary(
  yaml: string | undefined,
): AIDictionaryDocument {
  const raw = (yaml ? parseYamlRecord(yaml) : {}) as RawAIDictionary;
  const entries = Array.isArray(raw.entries) ? raw.entries : [];

  return {
    entries: entries.map((value, index): AIDictionaryEntry => {
      const entry = (isRecord(value) ? value : {}) as RawAIEntry;
      const title = stringOf(entry.title);
      return {
        category: stringOf(entry.category),
        code: stringOf(entry.code),
        id: stringOf(entry.id) || slugify(title, `entry-${index + 1}`),
        title,
      };
    }),
  };
}

export function stringifyAIDictionary(value: AIDictionaryDocument) {
  return YAML.stringify(
    {
      entries: value.entries.map((entry, index) => ({
        id: uniqueAIEntryId(entry, index),
        category: entry.category.trim(),
        title: entry.title.trim(),
        code: entry.code,
      })),
    },
    { lineWidth: 0 },
  );
}
