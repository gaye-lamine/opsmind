import { z } from "zod";
import { createLogger } from "@opsmind/shared";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../registry/tool.interface";
import { getMongoDbMcpClient } from "@opsmind/mcp-client";

const logger = createLogger("MongoDbSchemaTool");

// ─── Input Schema ─────────────────────────────────────────────────────────────

const mongoDbSchemaInputSchema = z.object({
  /** Database name (default: opsmind) */
  database: z.string().optional(),
  /** Collection name to inspect */
  collection: z.string().min(1),
});

type MongoDbSchemaInput = z.infer<typeof mongoDbSchemaInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const mongoDbSchemaOutputSchema = z.object({
  database: z.string(),
  collection: z.string(),
  schema: z.record(z.unknown()),
  fieldCount: z.number(),
  executedVia: z.literal("mongodb-mcp-server"),
});

type MongoDbSchemaOutput = z.infer<typeof mongoDbSchemaOutputSchema>;

// ─── Tool Implementation ──────────────────────────────────────────────────────

/**
 * MongoDbSchemaTool — inspects MongoDB collection schemas via the official MongoDB MCP Server.
 *
 * Gives the agent structural awareness of the data it's reasoning about.
 * Before running complex queries, the agent can understand what fields exist,
 * their types, and the overall shape of the data.
 *
 * Use cases:
 * - Understand the structure of operational_state before querying
 * - Verify field names before building aggregation pipelines
 * - Discover available metrics and anomaly fields
 */
export class MongoDbSchemaTool extends BaseTool<MongoDbSchemaInput, MongoDbSchemaOutput> {
  readonly name = "mongodb_schema";
  readonly description =
    "[MongoDB Atlas MCP] Inspects the schema of a MongoDB collection via the official MongoDB MCP Server. " +
    "REQUIRED input: { \"collection\": \"<name>\", \"database\": \"opsmind\" }. " +
    "Use this to understand the structure of data before querying. " +
    "Available collections: decisions, sessions, operational_state, actions, execution_logs, users, metrics.";
  readonly category = "memory_read" as const;
  readonly inputSchema = mongoDbSchemaInputSchema;
  readonly outputSchema = mongoDbSchemaOutputSchema;

  protected async run(input: MongoDbSchemaInput): Promise<ToolResult<MongoDbSchemaOutput>> {
    const database = input.database ?? "opsmind";
    logger.info("Inspecting MongoDB schema via MCP", {
      collection: input.collection,
      database,
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

    try {
      const result = await mcpClient.execute("collection-schema", {
        database,
        collection: input.collection,
      });

      const durationMs = Date.now() - start;

      if (!result.success) {
        return toolFailure(result.error.code, result.error.message, durationMs);
      }

      const schema = result.data;
      const fieldCount = countFields(schema);

      return toolSuccess(
        {
          database,
          collection: input.collection,
          schema,
          fieldCount,
          executedVia: "mongodb-mcp-server",
        },
        durationMs
      );
    } catch (error) {
      return toolFailure(
        "MONGODB_SCHEMA_FAILED",
        `Schema inspection failed: ${error instanceof Error ? error.message : String(error)}`,
        Date.now() - start
      );
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countFields(schema: Record<string, unknown>): number {
  if (typeof schema["properties"] === "object" && schema["properties"] !== null) {
    return Object.keys(schema["properties"] as object).length;
  }
  return Object.keys(schema).length;
}
