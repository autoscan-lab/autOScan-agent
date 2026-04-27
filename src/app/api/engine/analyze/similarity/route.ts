import { auth } from "@/auth";
import { EngineRequestError, runEngineSimilarityAnalyze } from "@/lib/engine/client";
import { parseAnalyzePayload } from "@/app/api/engine/_lib/analyze-request";
import { engineErrorResponse } from "@/app/api/engine/_lib/responses";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const payload = parseAnalyzePayload(body);
  if (!payload) {
    return new Response("Invalid analyze payload.", { status: 400 });
  }

  try {
    const result = await runEngineSimilarityAnalyze(payload.runId, {
      includeSpans: payload.includeSpans,
      minScore: payload.minScore,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof EngineRequestError) {
      return engineErrorResponse(error);
    }

    console.error("[/api/engine/analyze/similarity] request failed", error);
    return new Response("Engine similarity analyze request failed.", { status: 500 });
  }
}

