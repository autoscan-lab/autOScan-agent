import { randomUUID } from "node:crypto";

import { auth } from "@/auth";
import {
  deleteStoredFileByKey,
  saveUploadedFile,
  userStorageKey,
} from "@/lib/storage";
import { resolveSessionUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const maxZipBytes = 12 * 1024 * 1024;

function isZipUpload(file: File) {
  const filename = file.name.toLowerCase();
  const mediaType = file.type.toLowerCase();

  return (
    filename.endsWith(".zip") ||
    mediaType === "application/zip" ||
    mediaType === "application/x-zip-compressed"
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const uploaded = formData?.get("file");

  if (!(uploaded instanceof File)) {
    return new Response("Missing file upload.", { status: 400 });
  }

  if (!isZipUpload(uploaded)) {
    return new Response("Only .zip files are supported.", { status: 400 });
  }

  if (uploaded.size > maxZipBytes) {
    return new Response("Zip file is too large (max 12 MB).", { status: 400 });
  }

  const userId = resolveSessionUserId(session);
  const bytes = Buffer.from(await uploaded.arrayBuffer());
  const storedUpload = await saveUploadedFile({
    bytes,
    contentType: uploaded.type || "application/zip",
    filename: uploaded.name || "submissions.zip",
    runId: `chat-upload-${randomUUID()}`,
    userId,
  });

  return Response.json({
    filename: storedUpload.filename,
    mediaType: storedUpload.contentType,
    url: `r2://${storedUpload.key}`,
  });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : "";
  if (!url.startsWith("r2://")) {
    return new Response("Invalid upload reference.", { status: 400 });
  }

  const key = url.slice("r2://".length).trim().replace(/^\/+/, "");
  const userKey = userStorageKey(resolveSessionUserId(session));
  if (!key.includes(`/uploads/${userKey}/`)) {
    return new Response("Forbidden", { status: 403 });
  }

  await deleteStoredFileByKey(key);
  return Response.json({ ok: true });
}
