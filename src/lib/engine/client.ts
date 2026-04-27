import type { EngineResult } from "@/lib/storage";

export type EngineUpload = {
  bytes: Buffer;
  filename: string;
  mediaType: string;
};

type EngineAnalyzeOptions = {
  includeSpans?: boolean;
  minScore?: number;
};


export class EngineRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(message);
    this.name = "EngineRequestError";
  }
}

function engineBaseUrl() {
  const url = process.env.ENGINE_URL?.trim();
  if (!url) {
    throw new Error("ENGINE_URL is not configured.");
  }
  return url.replace(/\/$/, "");
}

function engineHeaders() {
  const headers: Record<string, string> = {};
  const secret = process.env.ENGINE_SECRET?.trim();

  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
    headers["X-Autoscan-Secret"] = secret;
  }

  return headers;
}

export async function parseEngineResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => undefined)
    : await response.text();

  if (!response.ok) {
    const detail =
      typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
    throw new EngineRequestError(
      `Engine request failed (${response.status}): ${detail}`,
      response.status,
      payload,
    );
  }

  return payload as T;
}

export async function setupEngineAssignment(assignmentName: string) {
  const response = await fetch(
    `${engineBaseUrl()}/setup/${encodeURIComponent(assignmentName)}`,
    {
      headers: engineHeaders(),
      method: "POST",
      signal: AbortSignal.timeout(60_000),
    },
  );

  return parseEngineResponse<unknown>(response);
}

export async function gradeEngineSubmissions(
  upload: EngineUpload,
) {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(upload.bytes)], {
    type: upload.mediaType,
  });
  formData.set("file", blob, upload.filename);

  const response = await fetch(`${engineBaseUrl()}/grade`, {
    body: formData,
    headers: engineHeaders(),
    method: "POST",
    signal: AbortSignal.timeout(240_000),
  });

  return parseEngineResponse<EngineResult>(response);
}

export async function runEngineGrade(
  assignmentName: string,
  upload: EngineUpload,
) {
  await setupEngineAssignment(assignmentName);
  return gradeEngineSubmissions(upload);
}

async function runEngineAnalyze(
  endpoint: "similarity" | "ai-detection",
  runId: string,
  options: EngineAnalyzeOptions = {},
) {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) {
    throw new Error("Missing engine run_id.");
  }

  const body: Record<string, unknown> = {
    run_id: normalizedRunId,
  };
  if (options.includeSpans !== undefined) {
    body.include_spans = options.includeSpans;
  }
  if (typeof options.minScore === "number" && options.minScore >= 0) {
    body.min_score = options.minScore;
  }

  const response = await fetch(`${engineBaseUrl()}/analyze/${endpoint}`, {
    body: JSON.stringify(body),
    headers: {
      ...engineHeaders(),
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(240_000),
  });

  return parseEngineResponse<EngineResult>(response);
}

export async function runEngineSimilarityAnalyze(
  runId: string,
  options: EngineAnalyzeOptions = {},
) {
  return runEngineAnalyze("similarity", runId, options);
}

export async function runEngineAiDetectionAnalyze(
  runId: string,
  options: EngineAnalyzeOptions = {},
) {
  return runEngineAnalyze("ai-detection", runId, options);
}
