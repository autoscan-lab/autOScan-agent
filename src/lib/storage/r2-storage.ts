import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";

import {
  buildRunKeys,
  safeObjectFilename,
  storagePrefix,
  userStorageKey,
} from "./storage-keys";

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

type LatestRunPointer = {
  runId: string;
  updatedAt: string;
};

type SaveUploadInput = {
  bytes: Buffer;
  contentType: string;
  filename: string;
  runId: string;
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

function latestRunKeyForUser(userId: string) {
  const prefix = storagePrefix();
  const userKey = userStorageKey(userId);
  return `${prefix}/runs/${userKey}/latest.json`;
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
}

export async function getGradingSession(userId: string, runId: string) {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) {
    return undefined;
  }

  const runKeys = buildRunKeys({
    runId: normalizedRunId,
    uploadFilename: "submissions.zip",
    userId,
  });

  return getJson<StoredGradingSession>(runKeys.runKey);
}

export async function saveLatestRunId(userId: string, runId: string) {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) {
    return;
  }
  await putJson<LatestRunPointer>(latestRunKeyForUser(userId), {
    runId: normalizedRunId,
    updatedAt: new Date().toISOString(),
  });
}

export async function getLatestRunId(userId: string) {
  const pointer = await getJson<LatestRunPointer>(latestRunKeyForUser(userId));
  if (!pointer || typeof pointer.runId !== "string") {
    return null;
  }
  const normalizedRunId = pointer.runId.trim();
  return normalizedRunId || null;
}

export async function getStoredFileByKey(key: string) {
  const normalizedKey = key.trim().replace(/^\/+/, "");
  if (!normalizedKey) {
    return undefined;
  }

  const file = await getObject(normalizedKey);
  if (!file) {
    return undefined;
  }

  return {
    bytes: file.bytes,
    contentType: file.contentType,
    key: normalizedKey,
  };
}

export async function getStoredTextByKey(key: string) {
  const file = await getStoredFileByKey(key);
  return file ? file.bytes.toString("utf8") : undefined;
}

export async function putStoredTextByKey(
  key: string,
  value: string,
  contentType = "text/plain; charset=utf-8",
) {
  const normalizedKey = key.trim().replace(/^\/+/, "");
  if (!normalizedKey) {
    throw new Error("Storage key is required.");
  }

  await putObject(normalizedKey, value, contentType);
}

export async function putStoredFileByKey(
  key: string,
  bytes: Buffer,
  contentType: string,
) {
  const normalizedKey = key.trim().replace(/^\/+/, "");
  if (!normalizedKey) {
    throw new Error("Storage key is required.");
  }

  await putObject(normalizedKey, bytes, contentType);
}

export async function listStoredKeysByPrefix(prefix: string) {
  const normalizedPrefix = prefix.trim().replace(/^\/+/, "");
  if (!normalizedPrefix) {
    return [];
  }

  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const listed = await r2Client().send(
      new ListObjectsV2Command({
        Bucket: bucketName(),
        ContinuationToken: continuationToken,
        Prefix: normalizedPrefix,
      }),
    );

    for (const object of listed.Contents ?? []) {
      if (object.Key) {
        keys.push(object.Key);
      }
    }

    continuationToken = listed.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

export async function deleteStoredFileByKey(key: string) {
  const normalizedKey = key.trim().replace(/^\/+/, "");
  if (!normalizedKey) {
    return;
  }

  await r2Client().send(
    new DeleteObjectCommand({
      Bucket: bucketName(),
      Key: normalizedKey,
    }),
  );
}

async function deleteObjectsByPrefix(prefix: string) {
  const normalizedPrefix = prefix.trim().replace(/^\/+/, "");
  if (!normalizedPrefix) {
    return;
  }

  let continuationToken: string | undefined;
  do {
    const listed = await r2Client().send(
      new ListObjectsV2Command({
        Bucket: bucketName(),
        ContinuationToken: continuationToken,
        Prefix: normalizedPrefix,
      }),
    );

    const objects = (listed.Contents ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => Boolean(key));

    if (objects.length > 0) {
      await r2Client().send(
        new DeleteObjectsCommand({
          Bucket: bucketName(),
          Delete: {
            Objects: objects.map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
    }

    continuationToken = listed.NextContinuationToken;
  } while (continuationToken);
}

export async function deleteUserStoredRuns(userId: string) {
  const prefix = storagePrefix();
  const userKey = userStorageKey(userId);
  await Promise.all([
    deleteObjectsByPrefix(`${prefix}/uploads/${userKey}/`),
    deleteObjectsByPrefix(`${prefix}/runs/${userKey}/`),
  ]);
}
