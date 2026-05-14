import { z } from "zod";
import { createLogger } from "@opsmind/shared";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../registry/tool.interface";
import { getMongoDbMcpClient } from "@opsmind/mcp-client";

const logger = createLogger("MongoDbQueryTool");

// ─── Input Schema ─────────────────────────────────────────────────────────────

const mongoDbQueryInputSchema = z.object({
  /**
   * "find" — query documents with a filter
   * "aggregate" — run an aggregation pipeline
   * "count" — count documents matching a filter
   */
  operation: z.enum(["find", "aggregate", "count"]).default("find"),
  /** Database name (default: opsmind) */
  database: z.string().default("opsmind"),
  /** Collection name */
  collection: z.string().min(1),
  /** MongoDB filter object (for find/count) */
  filter: z.record(z.unknown()).optional(),
  /** Aggregation pipeline stages (for aggregate) */
  pipeline: z.array(z.record(z.unknown())).optional(),
  /** Maximum number of documents to return */
  limit: z.number().int().positive().max(100).default(10),
  /** Fields to project (for find) */
  projection: z.record(z.unknown()).optional(),
  /** Sort order (for find) */
  sort: z.record(z.unknown()).optional(),
});

type MongoDbQueryInput = z.infer<typeof mongoDbQueryInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const mongoDbQueryOutputSchema = z.object({
  operation: z.string(),
  database: z.string(),
  collection: z.string(),
  documents: z.array(z.record(z.unknown())),
  count: z.number(),
  executedVia: z.literal("mongodb-mcp-server"),
});

type MongoDbQueryOutput = z.infer<typeof mongoDbQueryOutputSchema>;

// ─── Tool Implementation ──────────────────────────────────────────────────────

/**
 * MongoDbQueryTool — queries MongoDB collections via the official MongoDB MCP Server.
 *
 * This tool gives the agent direct access to MongoDB data through the
 * official MongoDB MCP Server (mongodb-js/mongodb-mcp-server).
 *
 * Unlike the internal read_operational_state tool which reads pre-structured
 * operational snapshots, this tool can query ANY collection with ANY filter —
 * enabling the agent to perform ad-hoc data analysis.
 *
 * Use cases:
 * - Query raw business data for deeper analysis
 * - Run aggregation pipelines for trend analysis
 * - Cross-reference data across collections
 */
export class MongoDbQueryTool extends BaseTool<MongoDbQueryInput, MongoDbQueryOutput> {
  readonly name = "mongodb_query";
  readonly description =
    "[MongoDB Atlas MCP] Queries MongoDB collections directly via the official MongoDB MCP Server. " +
    "REQUIRED input: { \"operation\": \"find\"|\"aggregate\"|\"count\", \"collection\": \"<name>\", \"database\": \"opsmind\" }. " +
    "Use operation='find' with filter to query documents. " +
    "Use operation='aggregate' with pipeline for complex analysis. " +
    "Use operation='count' to count matching documents. " +
    "Available collections: decisions, sessions, operational_state, actions, execution_logs.";
  readonly category = "memory_read" as const;
  readonly inputSchema = mongoDbQueryInputSchema;
  readonly outputSchema = mongoDbQueryOutputSchema;

  protected async run(input: MongoDbQueryInput): Promise<ToolResult<MongoDbQueryOutput>> {
    logger.info("Executing MongoDB query via MCP", {
      operation: input.operation,
      collection: input.collection,
      database: input.database,
    });

    let mcpClient;
    try {
      mcpClient = getMongoDbMcpClient();
    } catch {
      return toolFailure(
        "MCP_NOT_INITIALIZED",
        "MongoDB MCP client is not initialized. Ensure the MCP server is running.",
        0
      );
    }

    if (!mcpClient.isConnected) {
      return toolFailure(
        "MCP_NOT_CONNECTED",
        "MongoDB MCP client is not connected.",
        0
      );
    }

    const start = Date.now();

    try {
      let result;

      switch (input.operation) {
        case "find": {
          result = await mcpClient.execute("find", {
            database: input.database,
            collection: input.collection,
            ...(input.filter !== undefined ? { filter: input.filter } : {}),
            ...(input.limit !== undefined ? { limit: input.limit } : {}),
            ...(input.projection !== undefined ? { projection: input.projection } : {}),
            ...(input.sort !== undefined ? { sort: input.sort } : {}),
          });
          break;
        }
        case "aggregate": {
          result = await mcpClient.execute("aggregate", {
            database: input.database,
            collection: input.collection,
            pipeline: input.pipeline ?? [],
          });
          break;
        }
        case "count": {
          result = await mcpClient.execute("count", {
            database: input.database,
            collection: input.collection,
            ...(input.filter !== undefined ? { filter: input.filter } : {}),
          });
          break;
        }
      }

      const durationMs = Date.now() - start;

      if (!result.success) {
        return toolFailure(
          result.error.code,
          result.error.message,
          durationMs,
          result.error.details
        );
      }

      // Normalize the MCP response to our output schema
      const documents = extractDocuments(result.data);

      return toolSuccess(
        {
          operation: input.operation,
          database: input.database,
          collection: input.collection,
          documents,
          count: documents.length,
          executedVia: "mongodb-mcp-server",
        },
        durationMs
      );
    } catch (error) {
      return toolFailure(
        "MONGODB_QUERY_FAILED",
        `MongoDB query failed: ${error instanceof Error ? error.message : String(error)}`,
        Date.now() - start
      );
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDocuments(data: Record<string, unknown>): Array<Record<string, unknown>> {
  // MongoDB MCP Server returns documents in various shapes
  if (Array.isArray(data["documents"])) {
    return data["documents"] as Array<Record<string, unknown>>;
  }
  if (Array.isArray(data["result"])) {
    return data["result"] as Array<Record<string, unknown>>;
  }
  if (typeof data["count"] === "number") {
    return [{ count: data["count"] }];
  }
  // Wrap single object result
  return [data];
}
