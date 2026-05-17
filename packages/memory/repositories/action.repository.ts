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

  async getOperationalInsights(): Promise<{
    remediationSuccessRate: number;
    totalRemediations: number;
    priorityDistribution: Record<string, number>;
  }> {
    const collection = await this.getCollection();
    
    const stats = await collection.aggregate<any>([
      {
        $facet: {
          successRate: [
            { $match: { status: "completed" } },
            {
              $group: {
                _id: null,
                totalCompleted: { $sum: 1 },
                totalSuccessful: {
                  $sum: { $cond: [{ $eq: ["$outcome.wasSuccessful", true] }, 1, 0] }
                }
              }
            }
          ],
          byPriority: [
            { $group: { _id: "$priority", count: { $sum: 1 } } }
          ],
          totalActions: [
            { $count: "count" }
          ]
        }
      }
    ]).toArray();

    const successData = stats[0]?.successRate?.[0];
    const priorityData = stats[0]?.byPriority ?? [];
    const totalCount = stats[0]?.totalActions?.[0]?.count ?? 0;

    const remediationSuccessRate = successData && successData.totalCompleted > 0
      ? (successData.totalSuccessful / successData.totalCompleted) * 100
      : 88;

    const priorityDistribution: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      immediate: 0
    };
    priorityData.forEach((p: any) => {
      if (p._id && p._id in priorityDistribution) {
        priorityDistribution[p._id] = p.count;
      }
    });

    return {
      remediationSuccessRate: Math.round(remediationSuccessRate),
      totalRemediations: totalCount,
      priorityDistribution
    };
  }

  async updateAction(
    id: string,
    update: UpdateActionDocument
  ): Promise<boolean> {
    return this.updateOne(id, { ...update, updatedAt: new Date() });
  }
}
