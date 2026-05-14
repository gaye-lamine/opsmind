import { COLLECTION_NAMES } from "@opsmind/config";
import { BaseRepository } from "./base.repository";
import {
  type SessionDocument,
  type UpdateSessionDocument,
} from "../collections/sessions/schema";

/**
 * Repository for the `sessions` collection.
 *
 * Sessions are the execution context for agent runs.
 * This repository tracks the full lifecycle of each agent session —
 * from initialization through completion or failure.
 */
export class SessionRepository extends BaseRepository<SessionDocument> {
  constructor() {
    super(COLLECTION_NAMES.SESSIONS);
  }

  /**
   * Finds all sessions for a given status — used for monitoring active investigations.
   */
  async findByStatus(
    status: SessionDocument["status"]
  ): Promise<SessionDocument[]> {
    return this.findMany(
      { status },
      { sort: { startedAt: -1 }, limit: 50 }
    );
  }

  /**
   * Finds currently running sessions — used for the dashboard active investigations panel.
   */
  async findActive(): Promise<SessionDocument[]> {
    return this.findMany(
      { status: { $in: ["initializing", "running", "reflecting"] } },
      { sort: { startedAt: -1 } }
    );
  }

  /**
   * Finds recently completed sessions — used for the dashboard history.
   */
  async findRecentCompleted(limit: number): Promise<SessionDocument[]> {
    return this.findMany(
      { status: "completed" },
      { sort: { completedAt: -1 }, limit }
    );
  }

  /**
   * Updates session state during execution.
   * Called at each step of the reasoning pipeline to track progress.
   */
  async updateSession(
    id: string,
    update: UpdateSessionDocument
  ): Promise<boolean> {
    return this.updateOne(id, update);
  }

  /**
   * Marks a session as completed and links it to its decision.
   */
  async markCompleted(
    id: string,
    decisionId: string,
    durationMs: number
  ): Promise<boolean> {
    return this.updateOne(id, {
      status: "completed",
      decisionId,
      durationMs,
      completedAt: new Date(),
    });
  }

  /**
   * Marks a session as failed with error context.
   * Preserves the error for debugging and traceability.
   */
  async markFailed(
    id: string,
    error: { code: string; message: string; step?: string }
  ): Promise<boolean> {
    return this.updateOne(id, {
      status: "failed",
      error,
      completedAt: new Date(),
    });
  }

  /**
   * Marks a session as timed out.
   */
  async markTimeout(id: string): Promise<boolean> {
    return this.updateOne(id, {
      status: "timeout",
      completedAt: new Date(),
    });
  }
}
