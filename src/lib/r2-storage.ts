import { randomUUID } from "node:crypto";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";

import { buildExportKeys, buildRunKeys, safeObjectFilename } from "@/lib/storage-keys";

export type EngineResult = Record<string, unknown>;

export type StoredUpload = {
  contentType: string;
  filename: string;
  key: string;
  sizeBytes: number;
};

export type StoredGradingSession = {
  assignmentName: string;
  createdAt: string;
  id: string;
  result: EngineResult;
  updatedAt: string;
  uploads: StoredUpload[];
};

export type StoredExportMetadata = {
  contentType: string;
  createdAt: string;
  filename: string;
  id: string;
  key: string;
  runId?: string;
};

type SaveUploadInput = {
  bytes: Buffer;
  contentType: string;
  filename: string;
  runId: string;
  userId: string;
};

type SaveExportInput = {
  bytes: Buffer;
  contentType: string;
  filename: string;
  runId?: string;
  userId: string;
};

type ObjectBody = NonNullable<GetObjectCommandOutput["Body"]>;

type TransformableBody = {
  transformToByteArray: () => Promise<Uint8Array>;
};

let client: S3Client | undefined;

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function r2Client() {
  client ??= new S3Client({
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
    endpoint: `https://${requiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    region: "auto",
  });

  return client;
}

function bucketName() {
  return requiredEnv("R2_BUCKET_NAME");
}

function isMissingObjectError(error: unknown) {
  return (
    error instanceof S3ServiceException &&
    (error.name === "NoSuchKey" || error.$metadata.httpStatusCode === 404)
  );
}

function isTransformableBody(body: ObjectBody): body is ObjectBody & TransformableBody {
  return (
    "transformToByteArray" in body &&
    typeof body.transformToByteArray === "function"
  );
}

async function bodyToBuffer(body: ObjectBody | undefined) {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (isTransformableBody(body)) {
    return Buffer.from(await body.transformToByteArray());
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function putObject(
  key: string,
  body: Buffer | string,
  contentType: string
) {
  await r2Client().send(
    new PutObjectCommand({
      Body: body,
      Bucket: bucketName(),
      ContentType: contentType,
      Key: key,
    })
  );
}

async function getObject(key: string) {
  try {
    const response = await r2Client().send(
      new GetObjectCommand({
        Bucket: bucketName(),
        Key: key,
      })
    );

    return {
      bytes: await bodyToBuffer(response.Body),
      contentType: response.ContentType,
    };
  } catch (error) {
    if (isMissingObjectError(error)) {
      return undefined;
    }

    throw error;
  }
}

async function putJson<T>(key: string, value: T) {
  await putObject(key, JSON.stringify(value, null, 2), "application/json");
}

async function getJson<T>(key: string) {
  const object = await getObject(key);
  if (!object) {
    return undefined;
  }

  return JSON.parse(object.bytes.toString("utf8")) as T;
}

export async function saveUploadedFile(input: SaveUploadInput): Promise<StoredUpload> {
  const filename = safeObjectFilename(input.filename, "submissions.zip");
  const keys = buildRunKeys({
    runId: input.runId,
    uploadFilename: filename,
    userId: input.userId,
  });

  await putObject(keys.uploadKey, input.bytes, input.contentType);

  return {
    contentType: input.contentType,
    filename,
    key: keys.uploadKey,
    sizeBytes: input.bytes.byteLength,
  };
}

export async function saveGradingSession(
  userId: string,
  session: StoredGradingSession
) {
  const keys = buildRunKeys({
    runId: session.id,
    uploadFilename: session.uploads[0]?.filename ?? "submissions.zip",
    userId,
  });

  await putJson(keys.runKey, session);
  await putJson(keys.latestKey, {
    runId: session.id,
    updatedAt: session.updatedAt,
  });
}

export async function getLatestGradingSession(userId: string) {
  const pointerKeys = buildRunKeys({
    runId: "latest",
    uploadFilename: "submissions.zip",
    userId,
  });
  const pointer = await getJson<{ runId: string }>(pointerKeys.latestKey);

  if (!pointer?.runId) {
    return undefined;
  }

  const runKeys = buildRunKeys({
    runId: pointer.runId,
    uploadFilename: "submissions.zip",
    userId,
  });

  return getJson<StoredGradingSession>(runKeys.runKey);
}

export async function saveExportFile(input: SaveExportInput) {
  const id = randomUUID();
  const filename = safeObjectFilename(input.filename, "grades.xlsx");
  const keys = buildExportKeys({
    exportId: id,
    filename,
    userId: input.userId,
  });
  const metadata: StoredExportMetadata = {
    contentType: input.contentType,
    createdAt: new Date().toISOString(),
    filename,
    id,
    key: keys.fileKey,
    runId: input.runId,
  };

  await putObject(keys.fileKey, input.bytes, input.contentType);
  await putJson(keys.metadataKey, metadata);

  return metadata;
}

export async function getExportFile(userId: string, exportId: string) {
  const keys = buildExportKeys({
    exportId,
    filename: "grades.xlsx",
    userId,
  });
  const metadata = await getJson<StoredExportMetadata>(keys.metadataKey);

  if (!metadata) {
    return undefined;
  }

  const file = await getObject(metadata.key);
  if (!file) {
    return undefined;
  }

  return {
    bytes: file.bytes,
    metadata,
  };
}
