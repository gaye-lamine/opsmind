import { getEnv } from "../env/loader";

export interface DatabaseConfig {
  uri: string;
  dbName: string;
  options: {
    maxPoolSize: number;
    minPoolSize: number;
    connectTimeoutMS: number;
    socketTimeoutMS: number;
    serverSelectionTimeoutMS: number;
    retryWrites: boolean;
    retryReads: boolean;
  };
}

/**
 * MongoDB configuration derived from validated environment.
 * Tuned for operational workloads — persistent connections, retry logic.
 */
export function getDatabaseConfig(): DatabaseConfig {
  const env = getEnv();

  return {
    uri: env.MONGODB_URI,
    dbName: env.MONGODB_DB_NAME,
    options: {
      maxPoolSize: 10,
      minPoolSize: 2,
      connectTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
      serverSelectionTimeoutMS: 10_000,
      retryWrites: true,
      retryReads: true,
    },
  };
}

/**
 * MongoDB collection names — single source of truth.
 * Never hardcode collection names elsewhere.
 */
export const COLLECTION_NAMES = {
  DECISIONS: "decisions",
  ACTIONS: "actions",
  SESSIONS: "sessions",
  STATE: "operational_state",
  LOGS: "execution_logs",
} as const;

export type CollectionName =
  (typeof COLLECTION_NAMES)[keyof typeof COLLECTION_NAMES];
