type AnalyzePayload = {
  includeSpans?: boolean;
  runId: string;
  topK?: number;
};

function stringField(body: unknown, ...keys: string[]) {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function boolField(body: unknown, ...keys: string[]) {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return undefined;
}

function numberField(body: unknown, ...keys: string[]) {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.floor(value);
    }
  }
  return undefined;
}

export function parseAnalyzePayload(body: unknown): AnalyzePayload | null {
  const runId = stringField(body, "run_id", "runId");
  if (!runId) {
    return null;
  }

  const topK = numberField(body, "top_k", "topK");
  if (topK !== undefined && topK < 0) {
    return null;
  }

  return {
    includeSpans: boolField(body, "include_spans", "includeSpans"),
    runId,
    topK,
  };
}

