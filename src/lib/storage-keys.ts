import { createHash } from "node:crypto";

type RunKeyInput = {
  prefix?: string;
  runId: string;
  uploadFilename: string;
  userId: string;
};

type ExportKeyInput = {
  exportId: string;
  filename: string;
  prefix?: string;
  userId: string;
};

export function storagePrefix(prefix = process.env.R2_APP_PREFIX ?? "web") {
  return prefix.trim().replace(/^\/+|\/+$/g, "") || "web";
}

export function userStorageKey(userId: string) {
  return createHash("sha256")
    .update(userId.trim().toLowerCase())
    .digest("hex");
}

export function safeObjectFilename(filename: string | undefined, fallback: string) {
  const baseName = filename?.split(/[\\/]/).filter(Boolean).at(-1) ?? "";
  const safeName = baseName
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+(\.)/g, "$1")
    .replace(/^-+|-+$/g, "");

  return safeName || fallback;
}

export function buildRunKeys(input: RunKeyInput) {
  const prefix = storagePrefix(input.prefix);
  const userKey = userStorageKey(input.userId);
  const uploadFilename = safeObjectFilename(input.uploadFilename, "submissions.zip");

  return {
    latestKey: `${prefix}/users/${userKey}/latest.json`,
    runKey: `${prefix}/runs/${userKey}/${input.runId}.json`,
    uploadKey: `${prefix}/uploads/${userKey}/${input.runId}/${uploadFilename}`,
    userKey,
  };
}

export function buildExportKeys(input: ExportKeyInput) {
  const prefix = storagePrefix(input.prefix);
  const userKey = userStorageKey(input.userId);
  const filename = safeObjectFilename(input.filename, "grades.xlsx");

  return {
    fileKey: `${prefix}/exports/${userKey}/${input.exportId}/${filename}`,
    metadataKey: `${prefix}/exports/${userKey}/${input.exportId}.json`,
    userKey,
  };
}
