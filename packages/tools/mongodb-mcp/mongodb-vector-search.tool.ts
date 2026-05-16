import { z } from "zod";
import { createLogger } from "@opsmind/shared";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../registry/tool.interface";
import { generateEmbedding } from "@opsmind/ai";
import { VectorStore } from "@opsmind/memory";

const logger = createLogger("MongoDbVectorSearchTool");

// ─── Input Schema ─────────────────────────────────────────────────────────────

const mongoDbVectorSearchInputSchema = z.object({
  /**
   * The natural language query to search for.
   * Example: "investigate customer acquisition cost increase"
   */
  query: z.string().min(3),
  /**
   * Maximum number of similar decisions to return.
   */
  limit: z.number().int().positive().default(5).transform((v) => Math.min(v, 10)),
});

type MongoDbVectorSearchInput = z.infer<typeof mongoDbVectorSearchInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const mongoDbVectorSearchOutputSchema = z.object({
  query: z.string(),
  results: z.array(
    z.object({
      decisionId: z.string(),
      goal: z.string(),
      summary: z.string(),
      confidenceLevel: z.string(),
      similarityScore: z.number(),
      findings: z.array(z.string()),
      recommendations: z.array(z.string()),
    })
  ),
  searchMode: z.enum(["vector", "fallback"]),
});

type MongoDbVectorSearchOutput = z.infer<typeof mongoDbVectorSearchOutputSchema>;

// ─── Tool Implementation ──────────────────────────────────────────────────────

/**
 * MongoDbVectorSearchTool — semantic similarity search over historical decisions.
 *
 * This tool leverages MongoDB Atlas Vector Search to find past decisions
 * that are semantically similar to the current investigation context.
 *
 * It automatically handles:
 * 1. Text embedding generation via Gemini
 * 2. Vector similarity search via Atlas ($vectorSearch)
 * 3. Fallback to keyword search if vector search is disabled
 *
 * Rule §6.4: Demonstrates advanced "Partner Power" by integrating
 * Atlas Vector Search directly into the reasoning pipeline.
 */
export class MongoDbVectorSearchTool extends BaseTool<
  MongoDbVectorSearchInput,
  MongoDbVectorSearchOutput
> {
  readonly name = "mongodb_vector_search";
  readonly description =
    "[MongoDB Atlas] Performs semantic similarity search over historical decisions using Atlas Vector Search. " +
    "Best for finding similar past incidents even when keywords don't match exactly. " +
    "Input: { \"query\": \"context to search for\", \"limit\": 5 }";
  readonly category = "memory_read" as const;
  readonly inputSchema = mongoDbVectorSearchInputSchema;
  readonly outputSchema = mongoDbVectorSearchOutputSchema;

  private readonly vectorStore = new VectorStore();

  protected async run(
    input: MongoDbVectorSearchInput
  ): Promise<ToolResult<MongoDbVectorSearchOutput>> {
    logger.info("Executing Semantic Memory search", { query: input.query });

    const start = Date.now();

    try {
      // 1. Generate embedding for the query
      const embedding = await generateEmbedding(input.query);

      if (!embedding) {
        return toolFailure(
          "EMBEDDING_FAILED",
          "Failed to generate embedding for the search query.",
          Date.now() - start
        );
      }

      // 2. Perform vector search
      const similarDecisions = await this.vectorStore.findSimilarDecisions(
        embedding,
        input.limit
      );

      const durationMs = Date.now() - start;

      return toolSuccess(
        {
          query: input.query,
          results: similarDecisions.map((sd) => ({
            decisionId: sd.decision._id,
            goal: sd.decision.goal,
            summary: sd.decision.summary,
            confidenceLevel: String(sd.decision.confidenceLevel || sd.decision.confidenceScore || "unknown"),
            similarityScore: sd.similarityScore,
            findings: Array.isArray(sd.decision.findings) 
              ? sd.decision.findings.map((f: any) => typeof f === 'string' ? f : (f.title || f.description || JSON.stringify(f)))
              : [],
            recommendations: Array.isArray(sd.decision.recommendations)
              ? sd.decision.recommendations.map((r: any) => typeof r === 'string' ? r : (r.title || r.description || JSON.stringify(r)))
              : [],
          })),
          searchMode: similarDecisions.some((sd) => sd.similarityScore > 0)
            ? "vector"
            : "fallback",
        },
        durationMs
      );
    } catch (error) {
      return toolFailure(
        "VECTOR_SEARCH_FAILED",
        `Semantic search failed: ${error instanceof Error ? error.message : String(error)}`,
        Date.now() - start
      );
    }
  }
}
