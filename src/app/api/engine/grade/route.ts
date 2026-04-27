import { auth } from "@/auth";
import { EngineRequestError, runEngineGrade } from "@/lib/engine/client";
import { engineErrorResponse } from "../_lib/responses";

export const runtime = "nodejs";
export const maxDuration = 300;

const maxUploadBytes = 256 * 1024 * 1024;

function stringField(formData: FormData, ...keys: string[]) {
  for (const key of keys) {
    const value = formData.get(key);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return new Response("Invalid multipart form.", { status: 400 });
  }

  const assignmentName = stringField(
    formData,
    "assignment_name",
    "assignmentName",
    "assignment",
  );
  if (!assignmentName) {
    return new Response("Missing assignment name.", { status: 400 });
  }

  const uploaded = formData.get("file");
  if (!(uploaded instanceof File)) {
    return new Response("Missing file upload.", { status: 400 });
  }

  if (uploaded.size > maxUploadBytes) {
    return new Response("Zip file is too large (max 256 MB).", {
      status: 400,
    });
  }

  try {
    const result = await runEngineGrade(
      assignmentName,
      {
        bytes: Buffer.from(await uploaded.arrayBuffer()),
        filename: uploaded.name || "submissions.zip",
        mediaType: uploaded.type || "application/zip",
      },
    );

    return Response.json(result);
  } catch (error) {
    if (error instanceof EngineRequestError) {
      return engineErrorResponse(error);
    }

    console.error("[/api/engine/grade] request failed", error);
    return new Response("Engine grade request failed.", { status: 500 });
  }
}
