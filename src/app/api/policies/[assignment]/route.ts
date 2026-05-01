import { auth } from "@/auth";
import {
  defaultPolicy,
  parsePolicy,
  policyKey,
  stringifyPolicy,
} from "@/lib/policies/codec";
import { policyAssignments, type PolicyEditorDocument } from "@/lib/policies/types";
import {
  getStoredTextByKey,
  listStoredKeysByPrefix,
  putStoredTextByKey,
} from "@/lib/storage";

export const runtime = "nodejs";

function validAssignment(value: string) {
  return policyAssignments.includes(value as (typeof policyAssignments)[number]);
}

function outputFilename(key: string) {
  return key.split("/").filter(Boolean).at(-1) ?? key;
}

async function expectedOutputsForAssignment(assignment: string) {
  const prefix = `assignments/${assignment}/expected_outputs/`;
  const keys = await listStoredKeysByPrefix(prefix);
  const entries = await Promise.all(
    keys.map(async (key) => {
      const value = await getStoredTextByKey(key);
      return [outputFilename(key), value ?? ""] as const;
    }),
  );

  return Object.fromEntries(entries);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ assignment: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { assignment } = await context.params;
  if (!validAssignment(assignment)) {
    return new Response("Invalid assignment.", { status: 400 });
  }

  const policyYaml = await getStoredTextByKey(policyKey(assignment));
  if (!policyYaml) {
    return Response.json({ assignment, exists: false, policy: null });
  }

  const expectedOutputs = await expectedOutputsForAssignment(assignment);
  return Response.json({
    assignment,
    exists: true,
    policy: parsePolicy(policyYaml, expectedOutputs),
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ assignment: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { assignment } = await context.params;
  if (!validAssignment(assignment)) {
    return new Response("Invalid assignment.", { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    policy?: PolicyEditorDocument;
  } | null;
  const policy = body?.policy ?? defaultPolicy(assignment);
  const serialized = stringifyPolicy(assignment, policy);

  await Promise.all([
    putStoredTextByKey(
      policyKey(assignment),
      serialized.policyYaml,
      "application/x-yaml; charset=utf-8",
    ),
    ...Object.entries(serialized.expectedOutputs).map(([key, value]) =>
      putStoredTextByKey(key, value, "text/plain; charset=utf-8"),
    ),
  ]);

  const expectedOutputs = await expectedOutputsForAssignment(assignment);
  const savedYaml = await getStoredTextByKey(policyKey(assignment));

  return Response.json({
    assignment,
    exists: true,
    policy: parsePolicy(savedYaml ?? serialized.policyYaml, expectedOutputs),
  });
}
