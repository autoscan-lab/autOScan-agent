import { EngineRequestError } from "@/lib/engine/client";

export function engineErrorResponse(error: EngineRequestError) {
  if (typeof error.payload === "object" && error.payload !== null) {
    return Response.json(error.payload, { status: error.status });
  }

  return Response.json({ detail: error.message }, { status: error.status });
}
