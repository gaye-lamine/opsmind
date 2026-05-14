import { COLLECTION_NAMES } from "@opsmind/config";
import { type ActionStatus } from "@opsmind/shared";
import { BaseRepository } from "./base.repository";
import {
  type ActionDocument,
  type UpdateActionDocument,
} from "../collections/actions/schema";

/**
 * Repository for the `actions` collection.
 *
 * Actions are the operational outputs of the agent — recommendations that
 * get tracked through their lifecycle from recommendation to outcome.
 * Outcome tracking closes the feedback loop for future reasoning.
 */
export class ActionRepository extends BaseRepository<ActionDocument> {
  constructor() {
    super(COLLECTION_NAMES.ACTIONS);
  }

  /**
   * Finds all actions for a given decision.
   */
  async findByDecisionId(decisionId: string): Promise<ActionDocument[]> {
    return this.findMany(
      { decisionId },
      { sort: { priority: 1, createdAt: -1 } }
    );
  }

  /**
   * Finds all pending actions — used for the dashboard actions panel.
   */
  async findPending(): Promise<ActionDocument[]> {
    return this.findMany(
      { status: { $in: ["recommended", "acknowledged", "in_progress"] } },
      { sort: { priority: 1, createdAt: -1 } }
    );
  }

  /**
   * Finds actions by priority — used for immediate action surfacing.
   */
  async findByPriority(
    priority: ActionDocument["priority"]
  ): Promise<ActionDocument[]> {
    return this.findMany(
      { priority, status: { $in: ["recommended", "acknowledged"] } },
      { sort: { createdAt: -1 } }
    );
  }

  /**
   * Updates action status with audit trail.
   * Every status change is recorded in statusHistory.
   */
  async updateStatus(
    id: string,
    newStatus: ActionStatus,
    notes?: string
  ): Promise<boolean> {
    const collection = await this.getCollection();

    const current = await this.findById(id);
    if (!current) return false;

    const historyEntry = {
      from: current.status,
      to: newStatus,
      changedAt: new Date(),
      ...(notes !== undefined ? { notes } : {}),
    };

    const result = await collection.updateOne(
      { _id: id },
      {
        $set: { status: newStatus, updatedAt: new Date() },
        $push: { statusHistory: historyEntry },
      }
    );

    return result.matchedCount > 0;
  }

  /**
   * Records the outcome of a completed or dismissed action.
   * This is critical for the feedback loop — future reasoning can learn
   * which types of actions led to successful outcomes.
   */
  async recordOutcome(
    id: string,
    outcome: {
      wasSuccessful: boolean;
      notes: string;
      measuredImpact?: string;
    }
  ): Promise<boolean> {
    return this.updateOne(id, {
      outcome: { ...outcome, observedAt: new Date() },
      updatedAt: new Date(),
    });
  }

  /**
   * Finds completed actions with outcomes — used for historical pattern analysis.
   * The memory engine uses this to understand what worked in the past.
   */
  async findCompletedWithOutcomes(limit: number): Promise<ActionDocument[]> {
    return this.findMany(
      { status: "completed", outcome: { $exists: true } },
      { sort: { updatedAt: -1 }, limit }
    );
  }

  async updateAction(
    id: string,
    update: UpdateActionDocument
  ): Promise<boolean> {
    return this.updateOne(id, { ...update, updatedAt: new Date() });
  }
}
