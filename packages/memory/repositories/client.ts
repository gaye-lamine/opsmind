import { MongoClient, type Db } from "mongodb";
import { getDatabaseConfig } from "@opsmind/config";
import { createLogger } from "@opsmind/shared";

const logger = createLogger("MongoClient");

/**
 * MongoDB client singleton for OpsMind.
 *
 * Manages a single connection pool shared across all repositories.
 * The connection is established once at application startup and
 * reused for the lifetime of the process.
 *
 * Usage:
 *   const db = await getDatabase()
 *   const collection = db.collection<DecisionDocument>(COLLECTION_NAMES.DECISIONS)
 */

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectDatabase(): Promise<Db> {
  if (database !== null) return database;

  const config = getDatabaseConfig();

  logger.info("Connecting to MongoDB...", { dbName: config.dbName });

  client = new MongoClient(config.uri, config.options);

  await client.connect();

  // Verify connection
  await client.db("admin").command({ ping: 1 });

  database = client.db(config.dbName);

  logger.info("MongoDB connected successfully", { dbName: config.dbName });

  return database;
}

export async function getDatabase(): Promise<Db> {
  if (database !== null) return database;
  return connectDatabase();
}

export async function disconnectDatabase(): Promise<void> {
  if (client === null) return;

  logger.info("Disconnecting from MongoDB...");
  await client.close();
  client = null;
  database = null;
  logger.info("MongoDB disconnected");
}

/**
 * Checks if the database connection is alive.
 */
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    if (client === null) return false;
    await client.db("admin").command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
