import { createLogger } from "@opsmind/shared";
import { bootstrapTools } from "./tools/initializer";
import { McpToolRegistry } from "./registry/mcp-tool-registry";
import { McpServerInstance } from "./server/mcp-server";
import { createStdioTransport } from "./transport/stdio.transport";

const logger = createLogger("OpsMindMcpServer");

/**
 * OpsMind MCP Server — entry point.
 *
 * Startup sequence:
 * 1. Bootstrap tools (env → MongoDB → indexes → ToolRegistry)
 * 2. Load adapted tools into McpToolRegistry
 * 3. Create McpServerInstance
 * 4. Connect to stdio transport
 *
 * This process is designed to be spawned by an MCP client (Claude Desktop,
 * Cursor, Gemini Runtime, etc.) as a child process communicating via stdio.
 *
 * All logging goes to stderr — stdout is reserved for the MCP JSON-RPC stream.
 *
 * To switch transports in the future:
 *   Replace createStdioTransport() with createSseTransport() or createHttpTransport()
 *   Everything else remains unchanged.
 */
async function main(): Promise<void> {
  logger.info("Starting OpsMind MCP Server...");

  // 1. Bootstrap: env + MongoDB + tools
  await bootstrapTools();

  // 2. Adapt internal tools to MCP protocol
  const mcpRegistry = new McpToolRegistry();
  mcpRegistry.load();

  // 3. Create MCP server
  const mcpServer = new McpServerInstance(mcpRegistry);

  // 4. Connect to stdio transport
  const transport = createStdioTransport();
  await mcpServer.connect(transport);

  // ── Graceful Shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal} — shutting down MCP server...`);

    try {
      await mcpServer.close();
    } catch (err) {
      logger.error("Error closing MCP server", err instanceof Error ? err : undefined);
    }

    try {
      const { disconnectDatabase } = await import("@opsmind/memory");
      await disconnectDatabase();
      logger.info("MongoDB disconnected");
    } catch (err) {
      logger.error("Error disconnecting MongoDB", err instanceof Error ? err : undefined);
    }

    logger.info("MCP server shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT",  () => void shutdown("SIGINT"));

  // ── Unhandled Rejections ───────────────────────────────────────────────────
  process.on("unhandledRejection", (reason) => {
    logger.error(
      "Unhandled promise rejection",
      reason instanceof Error ? reason : undefined,
      { reason: String(reason) }
    );
  });

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception — shutting down", err);
    process.exit(1);
  });
}

main().catch((err: unknown) => {
  // Use console.error here — logger may not be initialized yet
  console.error("[OpsMind MCP Server] Fatal startup error:", err);
  process.exit(1);
});
