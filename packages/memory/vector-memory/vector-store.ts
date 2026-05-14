import { createLogger } from "@opsmind/shared";
import { getEnv } from "@opsmind/config";
import { DecisionRepository } from "../repositories/decision.repository";
import { type DecisionDocument } from "../collections/decisions/schema";

const logger = createLogger("VectorStore");

/**
 * Vector Store — semantic similarity search over historical decisions.
 *
 * When vector search is enabled (VECTOR_SEARCH_ENABLED=true), this module
 * uses MongoDB Atlas Vector Search to find semantically similar past decisions.
 *
 * When disabled, it falls back to keyword-based retrieval from the decision repository.
 * This ensures the system works in all environments, including local development.
 *
 * The vector store is used by the context assembler to find the most relevant
 * historical decisions for the current reasoning goal — not just the most recent ones.
 */

export interface SimilarDecision {
  decision: DecisionDocument;
  similarityScore: number;
}

export class VectorStore {
  private readonly decisionRepo = new DecisionRepository();

  /**
   * Finds decisions semantically similar to the given query.
   *
   * When vector search is enabled: uses MongoDB Atlas Vector Search ($vectorSearch).
   * When disabled: falls back to recency-based retrieval.
   *
   * @param queryEmbedding - The embedding vector of the current goal
   * @param limit - Maximum number of similar decisions to return
   */
  async findSimilarDecisions(
    queryEmbedding: number[],
    limit: number
  ): Promise<SimilarDecision[]> {
    const env = getEnv();

    if (env.VECTOR_SEARCH_ENABLED) {
      return this.vectorSearch(queryEmbedding, limit);
    }

    // Fallback: return recent finalized decisions
    logger.debug("Vector search disabled — using recency-based fallback");
    const decisions = await this.decisionRepo.findRecentFinalized(limit);
    return decisions.map((d) => ({ decision: d, similarityScore: 0 }));
  }

  /**
   * MongoDB Atlas Vector Search implementation.
   * Requires a vector search index named "decision_vector_index" on the decisions collection.
   *
   * Index definition (create in Atlas UI or via API):
   * {
   *   "fields": [{
   *     "type": "vector",
   *     "path": "embedding",
   *     "numDimensions": 768,
   *     "similarity": "cosine"
   *   }]
   * }
   */
  private async vectorSearch(
    queryEmbedding: number[],
    limit: number
  ): Promise<SimilarDecision[]> {
    try {
      const collection = await this.decisionRepo["getCollection"]();

      const pipeline = [
        {
          $vectorSearch: {
            index: "decision_vector_index",
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: limit * 10,
            limit,
            filter: { status: "finalized" },
          },
        },
        {
          $addFields: {
            similarityScore: { $meta: "vectorSearchScore" },
          },
        },
        {
          $project: {
            _id: 1,
            sessionId: 1,
            goal: 1,
            category: 1,
            summary: 1,
            findings: 1,
            recommendations: 1,
            confidenceScore: 1,
            confidenceLevel: 1,
            createdAt: 1,
            similarityScore: 1,
          },
        },
      ];

      const results = await collection.aggregate<DecisionDocument & { similarityScore: number }>(pipeline).toArray();

      return results.map((r) => ({
        decision: r,
        similarityScore: r.similarityScore,
      }));
    } catch (error) {
      logger.warn(
        "Vector search failed — falling back to recency-based retrieval",
        { error }
      );
      const decisions = await this.decisionRepo.findRecentFinalized(limit);
      return decisions.map((d) => ({ decision: d, similarityScore: 0 }));
    }
  }

  /**
   * Stores an embedding for a decision.
   * Called after the AI layer generates the embedding for a new decision.
   */
  async storeEmbedding(decisionId: string, embedding: number[]): Promise<void> {
    logger.debug("Storing embedding for decision", { decisionId });
    await this.decisionRepo.saveEmbedding(decisionId, embedding);
  }

  /**
   * Computes cosine similarity between two vectors.
   * Used for local similarity computation when Atlas Vector Search is unavailable.
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
      normA += (a[i] ?? 0) ** 2;
      normB += (b[i] ?? 0) ** 2;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
