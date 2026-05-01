import { auth } from "@/auth";
import { policyAssignments } from "@/lib/policies/types";
import { deleteStoredFileByKey, putStoredFileByKey } from "@/lib/storage";
import { safeObjectFilename, storagePrefix } from "@/lib/storage";

export const runtime = "nodejs";

const maxFileBytes = 5 * 1024 * 1024;

function policyFileKey(assignment: string, filename: string) {
  const prefix = storagePrefix();
  return `${prefix}/policies/${assignment}/files/${filename}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignment: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { assignment } = await params;
  if (!policyAssignments.includes(assignment as (typeof policyAssignments)[number])) {
    return new Response("Invalid assignment.", { status: 400 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return new Response("Missing file.", { status: 400 });
  }
  if (file.size > maxFileBytes) {
    return new Response("File too large (max 5 MB).", { status: 400 });
  }

  const filename = safeObjectFilename(file.name, "file");
  const bytes = Buffer.from(await file.arrayBuffer());
  await putStoredFileByKey(
    policyFileKey(assignment, filename),
    bytes,
    file.type || "application/octet-stream",
  );

  return Response.json({ filename });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ assignment: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { assignment } = await params;
  if (!policyAssignments.includes(assignment as (typeof policyAssignments)[number])) {
    return new Response("Invalid assignment.", { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const filename = typeof body?.filename === "string" ? body.filename.trim() : "";
  const safeFilename = safeObjectFilename(filename, "");
  if (!safeFilename) {
    return new Response("Invalid filename.", { status: 400 });
  }

  await deleteStoredFileByKey(policyFileKey(assignment, safeFilename));
  return Response.json({ ok: true });
}
