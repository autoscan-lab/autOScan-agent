import { MongoClient } from "mongodb";

const DEFAULT_DB_NAME = "autoscan_agent";

type GlobalMongo = {
  __autoscanMongoClientPromise?: Promise<MongoClient>;
};

const globalMongo = globalThis as typeof globalThis & GlobalMongo;

function requiredMongoUri() {
  const value = process.env.MONGODB_URI?.trim();
  if (!value) {
    throw new Error("MONGODB_URI is not configured.");
  }

  return value;
}

export async function getMongoClient() {
  if (!globalMongo.__autoscanMongoClientPromise) {
    const client = new MongoClient(requiredMongoUri(), {
      appName: "autOScan-agent",
      maxPoolSize: 20,
    });

    globalMongo.__autoscanMongoClientPromise = client.connect();
  }

  return globalMongo.__autoscanMongoClientPromise;
}

export async function getMongoDb() {
  const client = await getMongoClient();
  const dbName = process.env.MONGODB_DB_NAME?.trim() || DEFAULT_DB_NAME;
  return client.db(dbName);
}
