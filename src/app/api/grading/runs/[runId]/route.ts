import { auth } from "@/auth";
import { gradingRunFromSession } from "@/lib/grading";
import { getGradingSession } from "@/lib/storage";
import { resolveSessionUserId } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { runId } = await context.params;
  const gradingSession = await getGradingSession(
    resolveSessionUserId(session),
    runId,
  );

  if (!gradingSession) {
    return new Response("Grading run not found.", { status: 404 });
  }

  return Response.json(gradingRunFromSession(gradingSession));
}
