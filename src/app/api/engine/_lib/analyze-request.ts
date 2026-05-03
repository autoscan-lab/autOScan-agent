type AnalyzePayload = {
  includeSpans?: boolean;
  minScore?: number;
  runId: string;
};

function stringField(body: unknown, key: string) {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  const value = record[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return undefined;
}

function boolField(body: unknown, key: string) {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  const value = record[key];
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}

function floatField(body: unknown, key: string) {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

export function parseAnalyzePayload(body: unknown): AnalyzePayload | null {
  const runId = stringField(body, "run_id");
  if (!runId) {
    return null;
  }

  const minScore = floatField(body, "min_score");
  if (minScore !== undefined && (minScore < 0 || minScore > 100)) {
    return null;
  }

  return {
    includeSpans: boolField(body, "include_spans"),
    minScore,
    runId,
  };
}
