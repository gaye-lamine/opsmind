import { z } from "zod";
import { createLogger } from "@opsmind/shared";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../registry/tool.interface";
import { getMongoDbMcpClient } from "@opsmind/mcp-client";

const logger = createLogger("MongoDbListCollectionsTool");

const mongoDbListCollectionsInputSchema = z.object({
  /** Database name (default: opsmind) */
  database: z.string().optional(),
});

type MongoDbListCollectionsInput = z.infer<typeof mongoDbListCollectionsInputSchema>;

const mongoDbListCollectionsOutputSchema = z.object({
  database: z.string(),
  collections: z.array(z.string()),
  executedVia: z.literal("mongodb-mcp-server"),
});

type MongoDbListCollectionsOutput = z.infer<typeof mongoDbListCollectionsOutputSchema>;

/**
 * MongoDbListCollectionsTool — lists all collections in a database via the official MongoDB MCP Server.
 *
 * This is the FIRST tool the agent should use when exploring an unfamiliar database.
 * It provides the "map" of the data landscape.
 */
export class MongoDbListCollectionsTool extends BaseTool<
  MongoDbListCollectionsInput,
  MongoDbListCollectionsOutput
> {
  readonly name = "mongodb_list_collections";
  readonly description =
    "[MongoDB Atlas MCP] Lists all available collections in the database. " +
    "Use this FIRST to discover what data is available before inspecting schemas or querying. " +
    "Input: { \"database\": \"opsmind\" }";
  readonly category = "memory_read" as const;
  readonly inputSchema = mongoDbListCollectionsInputSchema;
  readonly outputSchema = mongoDbListCollectionsOutputSchema;

  protected async run(
    input: MongoDbListCollectionsInput
  ): Promise<ToolResult<MongoDbListCollectionsOutput>> {
    const database = input.database ?? "opsmind";
    logger.info("Listing MongoDB collections via MCP", { database });

    let mcpClient;
    try {
      mcpClient = getMongoDbMcpClient();
    } catch {
      return toolFailure("MCP_NOT_INITIALIZED", "MongoDB MCP client is not initialized.", 0);
    }

    const start = Date.now();

    try {
      const result = await mcpClient.execute("list-collections", { database });

      const durationMs = Date.now() - start;

      if (!result.success) {
        return toolFailure(result.error.code, result.error.message, durationMs);
      }

      // MCP response for list-collections is usually an array of collection names or objects
      const rawCollections = result.data as any;
      const collections = Array.isArray(rawCollections) 
        ? rawCollections.map(c => typeof c === 'string' ? c : c.name)
        : [];

      return toolSuccess(
        {
          database,
          collections,
          executedVia: "mongodb-mcp-server",
        },
        durationMs
      );
    } catch (error) {
      return toolFailure(
        "MONGODB_LIST_FAILED",
        `Failed to list collections: ${error instanceof Error ? error.message : String(error)}`,
        Date.now() - start
      );
    }
  }
}
