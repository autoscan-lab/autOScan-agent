import { auth } from "@/auth";
import { policyAssignments } from "@/lib/policies/types";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  return Response.json({ assignments: policyAssignments });
}
