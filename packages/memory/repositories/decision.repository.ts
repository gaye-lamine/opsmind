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
   * Performs a Hybrid Search — combining Atlas Search (full-text) and Vector Search (semantic).
   * 
   * This is the "ultimate" search experience: it finds exact matches for terms (like "Stripe" or "404")
   * while also finding semantically similar issues (like "payment failure").
   * 
   * @param query - The text search query
   * @param embedding - The vector embedding of the query
   * @param limit - Maximum number of results
   */
  async searchHybrid(
    query: string,
    embedding: number[],
    limit: number
  ): Promise<(DecisionDocument & { searchScore: number; searchType: "text" | "vector" | "hybrid" })[]> {
    try {
      const collection = await this.getCollection();

      // Run both searches in parallel
      const [vectorResults, textResults] = await Promise.all([
        // 1. Vector Search
        collection.aggregate<DecisionDocument & { score: number }>([
          {
            $vectorSearch: {
              index: "decision_vector_index",
              path: "embedding",
              queryVector: embedding,
              numCandidates: limit * 5,
              limit: limit,
              filter: { status: "finalized" }
            }
          },
          { $addFields: { score: { $meta: "vectorSearchScore" } } }
        ]).toArray().catch(() => []),

        // 2. Full-Text Search (Atlas Search)
        // Note: This will only work if the user creates a search index named "default"
        collection.aggregate<DecisionDocument & { score: number }>([
          {
            $search: {
              index: "default",
              text: {
                query: query,
                path: ["goal", "summary", "findings.title", "findings.description"],
                fuzzy: { maxEdits: 1 }
              }
            }
          },
          { $match: { status: "finalized" } },
          { $limit: limit },
          { $addFields: { score: { $meta: "searchScore" } } }
        ]).toArray().catch(() => [])
      ]);

      // Merge and deduplicate results with Min-Max Score Normalization
      const maxVectorScore = vectorResults.reduce((max, doc) => Math.max(max, doc.score ?? 0), 0);
      const maxTextScore = textResults.reduce((max, doc) => Math.max(max, doc.score ?? 0), 0);

      const resultsMap = new Map<string, DecisionDocument & { searchScore: number; searchType: "text" | "vector" | "hybrid" }>();

      // Add vector results first (normalize score dynamically)
      vectorResults.forEach(doc => {
        const normalizedScore = maxVectorScore > 0 ? (doc.score ?? 0) / maxVectorScore : 0;
        resultsMap.set(doc._id, {
          ...doc,
          searchScore: normalizedScore,
          searchType: "vector"
        });
      });

      // Merge text results (normalize score dynamically and sum)
      textResults.forEach(doc => {
        const normalizedScore = maxTextScore > 0 ? (doc.score ?? 0) / maxTextScore : 0;
        const existing = resultsMap.get(doc._id);
        if (existing) {
          // It's in both! Combine normalized scores and mark as hybrid
          existing.searchScore += normalizedScore;
          existing.searchType = "hybrid";
        } else {
          resultsMap.set(doc._id, {
            ...doc,
            searchScore: normalizedScore,
            searchType: "text"
          });
        }
      });

      // Sort by combined score and limit
      return Array.from(resultsMap.values())
        .sort((a, b) => b.searchScore - a.searchScore)
        .slice(0, limit);

    } catch (error) {
      this.logger.error("Hybrid search failed", { error });
      // Fallback to simple vector search if something fails (like missing text index)
      return this.findRecentFinalized(limit).then(docs => 
        docs.map(d => ({ ...d, searchScore: 0, searchType: "vector" as const }))
      );
    }
  }

  /**
   * Stores the embedding vector for a decision.
   * Called after the vector memory engine generates the embedding.
   */
  async saveEmbedding(id: string, embedding: number[]): Promise<boolean> {
    return this.updateOne(id, { embedding, updatedAt: new Date() });
  }
}
