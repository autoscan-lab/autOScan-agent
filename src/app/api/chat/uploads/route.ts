import { randomUUID } from "node:crypto";

import { auth } from "@/auth";
import { saveUploadedFile } from "@/lib/r2-storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const maxZipBytes = 12 * 1024 * 1024;

type AuthSessionLike = {
  user?: {
    email?: string | null;
    name?: string | null;
  };
} | null;

function sessionUserId(session: AuthSessionLike) {
  return session?.user?.email ?? session?.user?.name ?? "unknown-user";
}

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

  const userId = sessionUserId(session);
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
    sizeBytes: storedUpload.sizeBytes,
    url: `r2://${storedUpload.key}`,
  });
}
