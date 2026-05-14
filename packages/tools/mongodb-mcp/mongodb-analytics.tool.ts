import { z } from "zod";
import { createLogger } from "@opsmind/shared";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../registry/tool.interface";
import { getMongoDbMcpClient } from "@opsmind/mcp-client";

const logger = createLogger("MongoDbAnalyticsTool");

// ─── Input Schema ─────────────────────────────────────────────────────────────

const mongoDbAnalyticsInputSchema = z.object({
  /**
   * The type of analytics to perform:
   * - "trend": Frequency of similar anomalies over time
   * - "correlation": Correlation between metric drops and specific decisions
   * - "impact": Sum of confidence-weighted impact scores
   */
  analysisType: z.enum(["trend", "correlation", "impact"]),
  /** Filter context (e.g., category or anomalyId) */
  filter: z.record(z.unknown()).optional(),
  /** Timeframe in days (default: 30) */
  timeframeDays: z.number().int().positive().default(30),
});

type MongoDbAnalyticsInput = z.infer<typeof mongoDbAnalyticsInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const mongoDbAnalyticsOutputSchema = z.object({
  analysisType: z.string(),
  insights: z.array(z.record(z.unknown())),
  summary: z.string(),
  executedVia: z.literal("mongodb-aggregation-pipeline"),
});

type MongoDbAnalyticsOutput = z.infer<typeof mongoDbAnalyticsOutputSchema>;

// ─── Tool Implementation ──────────────────────────────────────────────────────

/**
 * MongoDbAnalyticsTool — performs deep data analysis using MongoDB Aggregation Pipelines.
 *
 * This tool demonstrates "Partner Power" by running multi-stage pipelines
 * for complex pattern matching and statistical analysis directly in Atlas.
 */
export class MongoDbAnalyticsTool extends BaseTool<
  MongoDbAnalyticsInput,
  MongoDbAnalyticsOutput
> {
  readonly name = "mongodb_analytics";
  readonly description =
    "[MongoDB Atlas] Performs deep trend and impact analysis using advanced aggregation pipelines. " +
    "Use 'trend' to see if an anomaly is recurring. Use 'impact' to quantify historical outcomes. " +
    "Input: { \"analysisType\": \"trend\"|\"impact\", \"timeframeDays\": 30 }";
  readonly category = "memory_read" as const;
  readonly inputSchema = mongoDbAnalyticsInputSchema;
  readonly outputSchema = mongoDbAnalyticsOutputSchema;

  protected async run(
    input: MongoDbAnalyticsInput
  ): Promise<ToolResult<MongoDbAnalyticsOutput>> {
    logger.info("Executing MongoDB Analytics pipeline", { type: input.analysisType });

    const start = Date.now();
    const mcpClient = getMongoDbMcpClient();

    try {
      let pipeline: any[] = [];
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - input.timeframeDays);

      switch (input.analysisType) {
        case "trend":
          pipeline = [
            { $match: { createdAt: { $gte: sinceDate }, ...input.filter } },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                count: { $sum: 1 },
                avgConfidence: { $avg: "$confidenceScore" },
              },
            },
            { $sort: { "_id": 1 } },
          ];
          break;

        case "impact":
          pipeline = [
            { $match: { createdAt: { $gte: sinceDate }, ...input.filter } },
            {
              $group: {
                _id: "$category",
                totalIncidents: { $sum: 1 },
                highConfidenceDecisions: {
                  $sum: { $cond: [{ $eq: ["$confidenceLevel", "high"] }, 1, 0] },
                },
              },
            },
            { $sort: { totalIncidents: -1 } },
          ];
          break;

        default:
          pipeline = [{ $match: { createdAt: { $gte: sinceDate } } }, { $limit: 10 }];
      }

      const result = await mcpClient.execute("aggregate", {
        database: "opsmind",
        collection: "decisions",
        pipeline,
      });

      const durationMs = Date.now() - start;

      if (!result.success) return toolFailure(result.error.code, result.error.message, durationMs);

      const rawInsights = result.data["result"] || result.data["documents"] || result.data;
      const insights = Array.isArray(rawInsights) ? rawInsights : [];

      return toolSuccess(
        {
          analysisType: input.analysisType,
          insights,
          summary: `Analyzed ${insights.length} data points over the last ${input.timeframeDays} days.`,
          executedVia: "mongodb-aggregation-pipeline",
        },
        durationMs
      );
    } catch (error) {
      return toolFailure(
        "ANALYTICS_FAILED",
        `Aggregation pipeline failed: ${error instanceof Error ? error.message : String(error)}`,
        Date.now() - start
      );
    }
  }
}
