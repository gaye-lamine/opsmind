import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLogger } from "@opsmind/shared";

const logger = createLogger("StdioTransport");

/**
 * Stdio Transport Factory — creates and configures the stdio MCP transport.
 *
 * stdio is the first transport implementation. The MCP server is designed
 * to be transport-agnostic: the McpServer class accepts any transport that
 * implements the SDK's Transport interface.
 *
 * Future transports (SSE, HTTP, WebSocket) will follow the same pattern:
 * - Create a factory function in this directory (e.g. sse.transport.ts)
 * - Return a Transport-compatible instance
 * - Pass it to McpServerInstance.connect(transport)
 * - No changes required to the McpServer, registry, or adapters
 *
 * stdio transport specifics:
 * - Reads from process.stdin, writes to process.stdout
 * - Used by Claude Desktop, Cursor, and other MCP clients that spawn
 *   the server as a child process
 * - All logging MUST go to stderr (not stdout) to avoid corrupting the
 *   JSON-RPC stream — the Logger in @opsmind/shared writes to stderr by default
 */
export function createStdioTransport(): StdioServerTransport {
  logger.debug("Creating stdio transport");

  const transport = new StdioServerTransport();

  return transport;
}
