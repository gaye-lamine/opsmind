import { COLLECTION_NAMES } from "@opsmind/config";
import { BaseRepository } from "./base.repository";
import {
  type ExecutionLogDocument,
  type InsertExecutionLogDocument,
} from "../collections/logs/schema";

/**
 * Repository for the `execution_logs` collection.
 *
 * Execution logs are append-only — they are never updated or deleted.
 * They provide full traceability of the agent's reasoning process.
 */
export class ExecutionLogRepository extends BaseRepository<ExecutionLogDocument> {
  constructor() {
    super(COLLECTION_NAMES.LOGS);
  }

  /**
   * Appends a log entry. Logs are insert-only.
   */
  async appendLog(
    document: InsertExecutionLogDocument
  ): Promise<ExecutionLogDocument> {
    return this.insertOne(document);
  }

  /**
   * Retrieves all logs for a session, ordered chronologically.
   * Used for session replay and debugging.
   */
  async findBySessionId(sessionId: string): Promise<ExecutionLogDocument[]> {
    return this.findMany(
      { sessionId },
      { sort: { timestamp: 1 } }
    );
  }

  /**
   * Retrieves error logs for a session — used for failure analysis.
   */
  async findErrorsBySessionId(
    sessionId: string
  ): Promise<ExecutionLogDocument[]> {
    return this.findMany(
      { sessionId, level: "error" },
      { sort: { timestamp: 1 } }
    );
  }

  /**
   * Retrieves logs for a specific pipeline step across all sessions.
   * Used for step-level performance analysis.
   */
  async findByStep(step: string, limit: number): Promise<ExecutionLogDocument[]> {
    return this.findMany(
      { step },
      { sort: { timestamp: -1 }, limit }
    );
  }

  /**
   * Retrieves logs associated with a specific decision.
   */
  async findByDecisionId(decisionId: string): Promise<ExecutionLogDocument[]> {
    return this.findMany(
      { decisionId },
      { sort: { timestamp: 1 } }
    );
  }
}
