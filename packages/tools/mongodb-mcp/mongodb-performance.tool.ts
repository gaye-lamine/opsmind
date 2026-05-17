import { z } from "zod";
import { createLogger } from "@opsmind/shared";
import { getCloudConfig } from "@opsmind/config";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../registry/tool.interface";
import { getMongoDbMcpClient } from "@opsmind/mcp-client";

const logger = createLogger("MongoDbPerformanceTool");

// ─── Input Schema ─────────────────────────────────────────────────────────────

const mongoDbPerformanceInputSchema = z.object({
  /**
   * "slow_queries" — analyze slow query logs
   * "index_suggestions" — get index recommendations
   * "cluster_stats" — get database statistics
   */
  analysisType: z
    .enum(["slow_queries", "index_suggestions", "cluster_stats"])
    .optional(),
  /** Database name for stats (default: opsmind) */
  database: z.string().optional(),
});

type MongoDbPerformanceInput = z.infer<typeof mongoDbPerformanceInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const mongoDbPerformanceOutputSchema = z.object({
  analysisType: z.string(),
  findings: z.array(z.record(z.unknown())),
  summary: z.string(),
  executedVia: z.literal("mongodb-mcp-server"),
});

type MongoDbPerformanceOutput = z.infer<typeof mongoDbPerformanceOutputSchema>;

// ─── Tool Implementation ──────────────────────────────────────────────────────

/**
 * MongoDbPerformanceTool — accesses MongoDB Atlas performance data
 * via the official MongoDB MCP Server.
 *
 * Gives the agent visibility into database performance, slow queries,
 * and index recommendations. This is unique to the MongoDB MCP integration —
 * it's not available through the internal tools.
 *
 * Use cases:
 * - Identify slow queries that may be causing operational issues
 * - Get index recommendations to improve query performance
 * - Analyze database statistics for capacity planning
 */
export class MongoDbPerformanceTool extends BaseTool<
  MongoDbPerformanceInput,
  MongoDbPerformanceOutput
> {
  readonly name = "mongodb_performance";
  readonly description =
    "[MongoDB Atlas MCP] Analyzes MongoDB Atlas performance via the official MongoDB MCP Server. " +
    "REQUIRED input: { \"analysisType\": \"slow_queries\"|\"index_suggestions\"|\"cluster_stats\" }. " +
    "Use analysisType='slow_queries' to find performance bottlenecks. " +
    "Use analysisType='index_suggestions' to get index recommendations. " +
    "Use analysisType='cluster_stats' to get database statistics.";
  readonly category = "analytics" as const;
  readonly inputSchema = mongoDbPerformanceInputSchema;
  readonly outputSchema = mongoDbPerformanceOutputSchema;

  protected async run(
    input: MongoDbPerformanceInput
  ): Promise<ToolResult<MongoDbPerformanceOutput>> {
    logger.info("Analyzing MongoDB performance via MCP", {
      analysisType: input.analysisType,
    });

    let mcpClient;
    try {
      mcpClient = getMongoDbMcpClient();
    } catch {
      return toolFailure(
        "MCP_NOT_INITIALIZED",
        "MongoDB MCP client is not initialized.",
        0
      );
    }

    // Let lazy reconnection inside mcpClient.execute handle connection state automatically.

    const start = Date.now();

    const analysisType = input.analysisType ?? "cluster_stats";
    const database = input.database ?? "opsmind";

    try {
      let result;
      let summary: string;

      switch (analysisType) {
        case "slow_queries": {
          // Use atlas-get-performance-advisor for slow query analysis
          const config = getCloudConfig();
          result = await mcpClient.execute("atlas-get-performance-advisor", {
            projectId: config.googleCloud.projectId,
            clusterName: "opsmind", // Hardcoded cluster name as per Atlas config
            type: "slowQueryLogs",
          });
          summary = "Slow query analysis from MongoDB Atlas Performance Advisor";
          break;
        }
        case "index_suggestions": {
          const config = getCloudConfig();
          result = await mcpClient.execute("atlas-get-performance-advisor", {
            projectId: config.googleCloud.projectId,
            clusterName: "opsmind",
            type: "suggestedIndexes",
          });
          summary = "Index recommendations from MongoDB Atlas Performance Advisor";
          break;
        }
        case "cluster_stats": {
          result = await mcpClient.execute("db-stats", {
            database,
          });
          summary = `Database statistics for ${database}`;
          break;
        }
      }

      const durationMs = Date.now() - start;

      if (!result.success) {
        return toolFailure(result.error.code, result.error.message, durationMs);
      }

      const findings = extractFindings(result.data);

      return toolSuccess(
        {
          analysisType,
          findings,
          summary,
          executedVia: "mongodb-mcp-server",
        },
        durationMs
      );
    } catch (error) {
      return toolFailure(
        "MONGODB_PERFORMANCE_FAILED",
        `Performance analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        Date.now() - start
      );
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractFindings(data: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(data["findings"])) {
    return data["findings"] as Array<Record<string, unknown>>;
  }
  if (Array.isArray(data["result"])) {
    return data["result"] as Array<Record<string, unknown>>;
  }
  return [data];
}
