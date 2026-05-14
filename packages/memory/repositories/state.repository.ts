import { COLLECTION_NAMES } from "@opsmind/config";
import { BaseRepository } from "./base.repository";
import {
  type OperationalStateDocument,
  type UpdateOperationalStateDocument,
} from "../collections/state/schema";

/**
 * Repository for the `operational_state` collection.
 *
 * Operational state snapshots are the business context the agent reasons over.
 * This repository manages the snapshot lifecycle — inserting new snapshots,
 * retrieving the current state, and querying historical state for trend analysis.
 *
 * State is append-only by design — snapshots are never deleted.
 */
export class OperationalStateRepository extends BaseRepository<OperationalStateDocument> {
  constructor() {
    super(COLLECTION_NAMES.STATE);
  }

  /**
   * Returns the current operational state — the most recent snapshot marked as current.
   * This is what the agent reads at the start of every reasoning session.
   */
  async findCurrent(): Promise<OperationalStateDocument | null> {
    return this.findOne({ isCurrent: true });
  }

  /**
   * Inserts a new state snapshot and marks it as current.
   * Atomically demotes the previous current snapshot.
   */
  async insertNewSnapshot(
    document: OperationalStateDocument
  ): Promise<OperationalStateDocument> {
    const collection = await this.getCollection();

    // Demote previous current snapshot
    await collection.updateMany(
      { isCurrent: true },
      { $set: { isCurrent: false } }
    );

    // Insert new snapshot as current
    return this.insertOne(document);
  }

  /**
   * Returns the N most recent state snapshots — used for trend analysis.
   */
  async findRecentSnapshots(limit: number): Promise<OperationalStateDocument[]> {
    return this.findMany({}, { sort: { snapshotAt: -1 }, limit });
  }

  /**
   * Returns snapshots within a time range — used for historical comparison.
   */
  async findInTimeRange(
    from: Date,
    to: Date
  ): Promise<OperationalStateDocument[]> {
    return this.findMany(
      { snapshotAt: { $gte: from, $lte: to } },
      { sort: { snapshotAt: -1 } }
    );
  }

  /**
   * Updates the current state — used when the agent resolves an anomaly
   * or updates investigation status without creating a full new snapshot.
   */
  async updateCurrentState(
    update: UpdateOperationalStateDocument
  ): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { isCurrent: true },
      { $set: update }
    );
    return result.matchedCount > 0;
  }

  /**
   * Finds snapshots that contain a specific anomaly — used for anomaly history.
   */
  async findSnapshotsWithAnomaly(
    metricName: string
  ): Promise<OperationalStateDocument[]> {
    return this.findMany(
      { "anomalies.metric": metricName },
      { sort: { snapshotAt: -1 }, limit: 20 }
    );
  }
}
