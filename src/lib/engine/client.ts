import type { EngineResult } from "@/lib/storage";

export type EngineUpload = {
  bytes: Buffer;
  filename: string;
  mediaType: string;
};

export type EngineGradeOptions = {
  includeAiDetection?: boolean;
  includeSimilarity?: boolean;
};

export type EngineSetupResult = {
  assignment: string;
  config_dir: string;
  files_downloaded: number;
  status: string;
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

  return parseEngineResponse<EngineSetupResult>(response);
}

export async function gradeEngineSubmissions(
  upload: EngineUpload,
  options: EngineGradeOptions = {},
) {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(upload.bytes)], {
    type: upload.mediaType,
  });
  formData.set("file", blob, upload.filename);

  if (options.includeSimilarity) {
    formData.set("include_similarity", "1");
  }
  if (options.includeAiDetection) {
    formData.set("include_ai_detection", "1");
  }

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
  options: EngineGradeOptions = {},
) {
  await setupEngineAssignment(assignmentName);
  return gradeEngineSubmissions(upload, options);
}
