import { createLogger } from "@opsmind/shared";
import { loadEnv } from "@opsmind/config";
import { connectDatabase, ensureIndexes } from "@opsmind/memory";
import { initializeTools } from "@opsmind/tools";

const logger = createLogger("ToolInitializer");

/**
 * Tool Initializer — bootstraps the OpsMind tool system for the MCP server.
 *
 * Bootstrap sequence (identical to apps/api):
 * 1. Load and validate environment variables
 * 2. Connect to MongoDB
 * 3. Ensure MongoDB indexes
 * 4. Initialize the internal ToolRegistry
 *
 * After this completes, the internal ToolRegistry is populated with all
 * OpsMind tools (read_operational_state, write_decision, etc.), and the
 * McpToolRegistry can adapt them into MCP Tool Definitions.
 *
 * Critical: this bootstrap MUST complete before the MCP server starts.
 * If any step fails, the process exits — no partial startup.
 *
 * Design note: the MCP server does NOT import @opsmind/agent or @opsmind/ai.
 * It only needs the tools layer (@opsmind/tools) and its dependencies
 * (@opsmind/memory, @opsmind/config, @opsmind/shared).
 */
export async function bootstrapTools(): Promise<void> {
  logger.info("Bootstrapping OpsMind tools for MCP server...");

  // 1. Validate environment
  loadEnv();
  logger.info("Environment validated");

  // 2. Connect MongoDB
  await connectDatabase();
  logger.info("MongoDB connected");

  // 3. Ensure indexes
  await ensureIndexes();
  logger.info("MongoDB indexes ensured");

  // 4. Initialize tools
  initializeTools();
  logger.info("Tool registry initialized");

  logger.info("Tool bootstrap complete");
}
