import { type Filter, type Sort } from "mongodb";
import { COLLECTION_NAMES } from "@opsmind/config";
import { type DecisionQueryDto } from "@opsmind/shared";
import { BaseRepository, type PaginatedResult } from "./base.repository";
import {
  type DecisionDocument,
  type UpdateDecisionDocument,
} from "../collections/decisions/schema";

/**
 * Repository for the `decisions` collection.
 *
 * Decisions are the primary memory artifact of OpsMind.
 * This repository provides domain-specific queries beyond basic CRUD —
 * historical retrieval, similarity lookup, and context assembly.
 */
export class DecisionRepository extends BaseRepository<DecisionDocument> {
  constructor() {
    super(COLLECTION_NAMES.DECISIONS);
  }

  /**
   * Retrieves the most recent finalized decisions for memory context assembly.
   * Used by the memory engine to provide historical context to the reasoning pipeline.
   */
  async findRecentFinalized(limit: number): Promise<DecisionDocument[]> {
    return this.findMany(
      { status: "finalized" },
      { sort: { createdAt: -1 }, limit }
    );
  }

  /**
   * Finds decisions by category — used to retrieve relevant historical precedents
   * when the agent is investigating a similar type of problem.
   */
  async findByCategory(
    category: DecisionDocument["category"],
    limit: number
  ): Promise<DecisionDocument[]> {
    return this.findMany(
      { category, status: "finalized" },
      { sort: { createdAt: -1 }, limit }
    );
  }

  /**
   * Finds all decisions for a given session.
   */
  async findBySessionId(sessionId: string): Promise<DecisionDocument[]> {
    return this.findMany({ sessionId }, { sort: { createdAt: -1 } });
  }

  /**
   * Paginated query with filters — used by the API for the decisions list view.
   */
  async queryPaginated(
    query: DecisionQueryDto
  ): Promise<PaginatedResult<DecisionDocument>> {
    const filter: Filter<DecisionDocument> = {};

    if (query.category) filter.category = query.category;
    if (query.status) filter.status = query.status;
    if (query.sessionId) filter.sessionId = query.sessionId;

    if (query.from ?? query.to) {
      filter.createdAt = {};
      if (query.from) filter.createdAt.$gte = query.from;
      if (query.to) filter.createdAt.$lte = query.to;
    }

    const sort: Sort = { createdAt: -1 };

    return this.findPaginated(
      filter,
      { page: query.page, pageSize: query.pageSize },
      { sort }
    );
  }

  /**
   * Updates a decision — used after reflection to attach the reflection output
   * and finalize the decision status.
   */
  async updateDecision(
    id: string,
    update: UpdateDecisionDocument
  ): Promise<boolean> {
    return this.updateOne(id, { ...update, updatedAt: new Date() });
  }

  /**
   * Marks a decision as superseded when a newer decision replaces it.
   * Preserves history — never deletes.
   */
  async markSuperseded(id: string): Promise<boolean> {
    return this.updateOne(id, {
      status: "superseded",
      updatedAt: new Date(),
    });
  }

  /**
   * Finds decisions that reference specific metrics — used for anomaly correlation.
   * Searches within the findings array for metric references.
   */
  async findByMetricReference(metricName: string): Promise<DecisionDocument[]> {
    return this.findMany(
      {
        "findings.relatedMetrics": metricName,
        status: "finalized",
      },
      { sort: { createdAt: -1 }, limit: 10 }
    );
  }

  /**
   * Retrieves decisions with stored embeddings for vector similarity search.
   * Only returns documents that have been embedded.
   */
  async findWithEmbeddings(limit: number): Promise<DecisionDocument[]> {
    return this.findMany(
      { embedding: { $exists: true }, status: "finalized" },
      { sort: { createdAt: -1 }, limit }
    );
  }

  /**
   * Stores the embedding vector for a decision.
   * Called after the vector memory engine generates the embedding.
   */
  async saveEmbedding(id: string, embedding: number[]): Promise<boolean> {
    return this.updateOne(id, { embedding, updatedAt: new Date() });
  }
}
