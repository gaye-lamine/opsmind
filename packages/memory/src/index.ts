/**
 * @opsmind/memory
 *
 * Operational memory layer for OpsMind.
 * MongoDB is NOT a simple database here — it is the intelligence substrate.
 *
 * This package owns:
 * - MongoDB connection management
 * - Collection schemas (Zod-validated documents)
 * - Typed repositories (one per collection)
 * - Memory engine (context assembly, memory writing)
 * - Vector memory (semantic similarity search)
 * - Index management
 *
 * Dependency rule: imports from @opsmind/config and @opsmind/shared only.
 * Never imports from @opsmind/agent, @opsmind/ai, or @opsmind/tools.
 *
 * Usage:
 *   import { connectDatabase, DecisionRepository, ContextAssembler } from '@opsmind/memory'
 *
 *   // At application bootstrap:
 *   await connectDatabase()
 *   await ensureIndexes()
 */

// ─── Database Connection ──────────────────────────────────────────────────────
export {
  connectDatabase,
  getDatabase,
  disconnectDatabase,
  isDatabaseHealthy,
} from "../repositories/client";

// ─── Index Management ─────────────────────────────────────────────────────────
export { ensureIndexes } from "../repositories/indexes";

// ─── Collection Schemas ───────────────────────────────────────────────────────
export {
  decisionDocumentSchema,
  insertDecisionSchema,
  updateDecisionSchema,
  type DecisionDocument,
  type InsertDecisionDocument,
  type UpdateDecisionDocument,
} from "../collections/decisions/schema";

export {
  sessionDocumentSchema,
  insertSessionSchema,
  updateSessionSchema,
  type SessionDocument,
  type InsertSessionDocument,
  type UpdateSessionDocument,
} from "../collections/sessions/schema";

export {
  operationalStateDocumentSchema,
  insertOperationalStateSchema,
  updateOperationalStateSchema,
  type OperationalStateDocument,
  type InsertOperationalStateDocument,
  type UpdateOperationalStateDocument,
} from "../collections/state/schema";

export {
  actionDocumentSchema,
  insertActionSchema,
  updateActionSchema,
  type ActionDocument,
  type InsertActionDocument,
  type UpdateActionDocument,
} from "../collections/actions/schema";

export {
  executionLogDocumentSchema,
  insertExecutionLogSchema,
  type ExecutionLogDocument,
  type InsertExecutionLogDocument,
} from "../collections/logs/schema";

// ─── Repositories ─────────────────────────────────────────────────────────────
export {
  BaseRepository,
  type PaginationOptions,
  type PaginatedResult,
} from "../repositories/base.repository";

export { DecisionRepository } from "../repositories/decision.repository";
export { SessionRepository } from "../repositories/session.repository";
export { OperationalStateRepository } from "../repositories/state.repository";
export { ActionRepository } from "../repositories/action.repository";
export { ExecutionLogRepository } from "../repositories/log.repository";

// ─── Memory Engine ────────────────────────────────────────────────────────────
export {
  ContextAssembler,
  type AssembledContext,
  type HistoricalDecisionSummary,
  type AnomalyHistoryEntry,
  type ActionPatternSummary,
} from "../memory-engine/context-assembler";

export { MemoryWriter } from "../memory-engine/memory-writer";

// ─── Vector Memory ────────────────────────────────────────────────────────────
export {
  VectorStore,
  type SimilarDecision,
} from "../vector-memory/vector-store";
