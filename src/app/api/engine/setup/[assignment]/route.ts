import { auth } from "@/auth";
import {
  EngineRequestError,
  setupEngineAssignment,
} from "@/lib/engine/client";
import { engineErrorResponse } from "../../_lib/responses";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _request: Request,
  context: { params: Promise<{ assignment: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { assignment } = await context.params;
  const assignmentName = assignment.trim();
  if (!assignmentName || /[/\\]/.test(assignmentName)) {
    return new Response("Invalid assignment name.", { status: 400 });
  }

  try {
    return Response.json(await setupEngineAssignment(assignmentName));
  } catch (error) {
    if (error instanceof EngineRequestError) {
      return engineErrorResponse(error);
    }

    console.error("[/api/engine/setup] request failed", error);
    return new Response("Engine setup request failed.", { status: 500 });
  }
}
