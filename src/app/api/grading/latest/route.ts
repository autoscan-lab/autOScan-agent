import { auth } from "@/auth";
import { latestFromSession } from "@/lib/grading";
import { getLatestGradingSession } from "@/lib/r2-storage";

export const runtime = "nodejs";

type AuthSessionLike = {
  user?: {
    email?: string | null;
    name?: string | null;
  };
} | null;

function sessionUserId(session: AuthSessionLike) {
  return session?.user?.email ?? session?.user?.name ?? "unknown-user";
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const latest = await getLatestGradingSession(sessionUserId(session));
  return Response.json(latestFromSession(latest));
}
