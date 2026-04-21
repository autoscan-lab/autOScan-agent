import { randomUUID } from "node:crypto";

import { MongoServerError } from "mongodb";
import type { UIMessage } from "ai";

import { getMongoDb } from "@/lib/mongodb";
import { userStorageKey } from "@/lib/storage-keys";

const chatCollectionName = "chat_state";
const maxStoredMessages = 120;
const maxStoredBytes = 1_500_000;
const maxAttachmentDataUrlChars = 8_000;

type ChatStateDocument = {
  _id: string;
  chatId: string;
  createdAt: Date;
  messages: UIMessage[];
  updatedAt: Date;
  userId: string;
};

export type PersistedChatState = {
  chatId: string;
  messages: UIMessage[];
  updatedAt: string;
};

function normalizedUserId(userId: string | undefined) {
  return userId?.trim() || "anonymous";
}

async function chatCollection() {
  const db = await getMongoDb();
  return db.collection<ChatStateDocument>(chatCollectionName);
}

function sanitizeMessage(message: UIMessage): UIMessage {
  const parts = message.parts.map((part) => {
    if (part.type !== "file") {
      return part;
    }

    if (
      typeof part.url === "string" &&
      part.url.startsWith("data:") &&
      part.url.length > maxAttachmentDataUrlChars
    ) {
      return {
        ...part,
        url: "about:blank#attachment-redacted",
      };
    }

    return part;
  });

  return {
    ...message,
    parts,
  };
}

function boundedMessages(messages: UIMessage[]) {
  const initial = messages.slice(-maxStoredMessages).map(sanitizeMessage);
  let bounded = initial;

  while (bounded.length > 1) {
    const bytes = Buffer.byteLength(JSON.stringify(bounded), "utf8");
    if (bytes <= maxStoredBytes) {
      break;
    }

    bounded = bounded.slice(1);
  }

  return bounded;
}

function toState(document: ChatStateDocument): PersistedChatState {
  return {
    chatId: document.chatId,
    messages: document.messages,
    updatedAt: document.updatedAt.toISOString(),
  };
}

async function createState(userId: string, userKey: string) {
  const now = new Date();
  const document: ChatStateDocument = {
    _id: userKey,
    chatId: randomUUID(),
    createdAt: now,
    messages: [],
    updatedAt: now,
    userId,
  };

  try {
    await (await chatCollection()).insertOne(document);
    return document;
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) {
      throw error;
    }

    const existing = await (await chatCollection()).findOne({ _id: userKey });
    if (!existing) {
      throw error;
    }

    return existing;
  }
}

export async function getChatState(userId: string | undefined) {
  const normalized = normalizedUserId(userId);
  const userKey = userStorageKey(normalized);
  const collection = await chatCollection();
  const existing = await collection.findOne({ _id: userKey });

  if (existing) {
    return toState(existing);
  }

  return toState(await createState(normalized, userKey));
}

export async function saveChatState(
  userId: string | undefined,
  input: {
    chatId: string;
    messages: UIMessage[];
  },
) {
  const normalized = normalizedUserId(userId);
  const userKey = userStorageKey(normalized);
  const now = new Date();
  const chatId = input.chatId.trim() || randomUUID();
  const messages = boundedMessages(input.messages);
  const collection = await chatCollection();

  await collection.updateOne(
    { _id: userKey },
    {
      $set: {
        chatId,
        messages,
        updatedAt: now,
        userId: normalized,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );

  return {
    chatId,
    messages,
    updatedAt: now.toISOString(),
  };
}

export async function clearChatState(userId: string | undefined) {
  const normalized = normalizedUserId(userId);
  const userKey = userStorageKey(normalized);
  const now = new Date();
  const chatId = randomUUID();
  const collection = await chatCollection();

  await collection.updateOne(
    { _id: userKey },
    {
      $set: {
        chatId,
        messages: [],
        updatedAt: now,
        userId: normalized,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );

  return {
    chatId,
    messages: [] as UIMessage[],
    updatedAt: now.toISOString(),
  };
}
