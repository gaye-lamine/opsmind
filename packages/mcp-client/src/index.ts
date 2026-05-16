/**
 * @opsmind/mcp-client
 *
 * Generic MCP client layer for OpsMind.
 *
 * This package connects to external MCP servers (MongoDB Atlas, etc.)
 * and exposes their tools through the IToolExecutor interface.
 *
 * Key design principles:
 * - All MCP SDK types are encapsulated — never leak to callers
 * - All responses normalized via McpResponseParser (single transformation point)
 * - IToolExecutor interface makes McpClient substitutable for ToolRegistry
 * - No business logic, no agent runtime knowledge
 *
 * Dependency rule: imports from @opsmind/shared only.
 * Never imports from @opsmind/agent, @opsmind/ai, @opsmind/memory, @opsmind/tools.
 */

// ─── Core Client ──────────────────────────────────────────────────────────────
export { McpClient } from "./client/mcp-client";

// ─── Factories ────────────────────────────────────────────────────────────────
export {
  createMongoDbMcpClient,
  getMongoDbMcpClient,
  initializeMongoDbMcpClient,
  disconnectMongoDbMcpClient,
} from "./factories/mongodb-mcp.factory";

export {
  createGitLabMcpClient,
  getGitLabMcpClient,
  initializeGitLabMcpClient,
  disconnectGitLabMcpClient,
} from "./factories/gitlab-mcp.factory";

// ─── Types (public contracts) ─────────────────────────────────────────────────
export type {
  IToolExecutor,
  NormalizedToolResult,
  NormalizedToolSuccess,
  NormalizedToolFailure,
  MongoDbMcpConfig,
  McpClientState,
  McpConnectionStatus,
} from "./types/mcp-client.types";
