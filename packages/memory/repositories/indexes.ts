import { createLogger } from "@opsmind/shared";
import { COLLECTION_NAMES } from "@opsmind/config";
import { getDatabase } from "./client";

const logger = createLogger("IndexManager");

/**
 * MongoDB index definitions for all OpsMind collections.
 *
 * Indexes are created at application startup via ensureIndexes().
 * They are idempotent — safe to call multiple times.
 *
 * Index strategy:
 * - decisions: query by status, category, sessionId, createdAt, metric references
 * - sessions: query by status, startedAt
 * - operational_state: query by isCurrent, snapshotAt
 * - actions: query by decisionId, status, priority
 * - execution_logs: query by sessionId, level, step, timestamp
 */
export async function ensureIndexes(): Promise<void> {
  logger.info("Ensuring MongoDB indexes...");

  const db = await getDatabase();

  await Promise.all([
    ensureDecisionIndexes(db),
    ensureSessionIndexes(db),
    ensureStateIndexes(db),
    ensureActionIndexes(db),
    ensureLogIndexes(db),
  ]);

  logger.info("MongoDB indexes ensured");
}

async function ensureDecisionIndexes(db: Awaited<ReturnType<typeof getDatabase>>): Promise<void> {
  const col = db.collection(COLLECTION_NAMES.DECISIONS);

  await Promise.all([
    col.createIndex({ status: 1, createdAt: -1 }),
    col.createIndex({ category: 1, status: 1, createdAt: -1 }),
    col.createIndex({ sessionId: 1 }),
    col.createIndex({ createdAt: -1 }),
    col.createIndex({ "findings.relatedMetrics": 1 }),
    col.createIndex({ confidenceScore: -1 }),
    // Sparse index for embedding — only indexes documents that have embeddings
    col.createIndex({ embedding: 1 }, { sparse: true }),
  ]);
}

async function ensureSessionIndexes(db: Awaited<ReturnType<typeof getDatabase>>): Promise<void> {
  const col = db.collection(COLLECTION_NAMES.SESSIONS);

  await Promise.all([
    col.createIndex({ status: 1, startedAt: -1 }),
    col.createIndex({ startedAt: -1 }),
    col.createIndex({ completedAt: -1 }, { sparse: true }),
  ]);
}

async function ensureStateIndexes(db: Awaited<ReturnType<typeof getDatabase>>): Promise<void> {
  const col = db.collection(COLLECTION_NAMES.STATE);

  // Drop the conflicting plain isCurrent_1 index if it exists (created by seed script)
  // before creating the partial index version
  try {
    await col.dropIndex("isCurrent_1");
  } catch {
    // Index doesn't exist — that's fine
  }

  await Promise.all([
    // Partial index with explicit name — only indexes documents where isCurrent: true
    col.createIndex(
      { isCurrent: 1 },
      { name: "isCurrent_partial", partialFilterExpression: { isCurrent: true } }
    ),
    col.createIndex({ snapshotAt: -1 }),
    col.createIndex({ "anomalies.metric": 1 }),
    col.createIndex({ "anomalies.status": 1 }),
  ]);
}

async function ensureActionIndexes(db: Awaited<ReturnType<typeof getDatabase>>): Promise<void> {
  const col = db.collection(COLLECTION_NAMES.ACTIONS);

  await Promise.all([
    col.createIndex({ decisionId: 1 }),
    col.createIndex({ sessionId: 1 }),
    col.createIndex({ status: 1, priority: 1, createdAt: -1 }),
    col.createIndex({ priority: 1, status: 1 }),
  ]);
}

async function ensureLogIndexes(db: Awaited<ReturnType<typeof getDatabase>>): Promise<void> {
  const col = db.collection(COLLECTION_NAMES.LOGS);

  await Promise.all([
    col.createIndex({ sessionId: 1, timestamp: 1 }),
    col.createIndex({ level: 1, timestamp: -1 }),
    col.createIndex({ step: 1, timestamp: -1 }),
    col.createIndex({ decisionId: 1 }, { sparse: true }),
    // TTL index — auto-delete debug logs after 30 days
    col.createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { level: "debug" } }
    ),
  ]);
}
