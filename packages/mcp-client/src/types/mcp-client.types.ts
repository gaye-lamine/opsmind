import { type ToolManifest } from "@opsmind/shared";

/**
 * MCP Client Types — internal contracts for the MCP client layer.
 *
 * These types are NEVER exposed outside packages/mcp-client.
 * The rest of the system only sees IToolExecutor and ToolResult.
 */

// ─── Client Configuration ─────────────────────────────────────────────────────

/**
 * Configuration for spawning a stdio MCP server process.
 */
export interface StdioMcpServerConfig {
  /** The command to run (e.g. "npx") */
  command: string;
  /** Arguments to pass to the command */
  args: string[];
  /** Environment variables to pass to the process */
  env?: Record<string, string>;
  /** Human-readable name for logging */
  serverName: string;
}

/**
 * Configuration for the MongoDB Atlas MCP Server.
 */
export interface MongoDbMcpConfig {
  /** MongoDB connection string */
  connectionString: string;
  /** Atlas service account client ID (optional — enables Atlas tools) */
  atlasClientId?: string;
  /** Atlas service account client secret (optional — enables Atlas tools) */
  atlasClientSecret?: string;
  /** Run in read-only mode (default: true for safety) */
  readOnly?: boolean;
}

// ─── Connection Status ────────────────────────────────────────────────────────

export type McpConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface McpClientState {
  status: McpConnectionStatus;
  serverName: string;
  connectedAt?: Date;
  toolCount: number;
  error?: string;
}

// ─── Raw MCP Response ─────────────────────────────────────────────────────────

/**
 * Raw content block from an MCP tools/call response.
 * Kept internal — never exposed to the agent runtime.
 */
export interface McpContentBlock {
  type: "text" | "image" | "resource";
  text?: string;
}

/**
 * Raw MCP tools/call result.
 * Kept internal — normalized to ToolResult before leaving this package.
 */
export interface RawMcpCallResult {
  content: McpContentBlock[];
  isError?: boolean;
}

/**
 * Raw MCP tool definition from tools/list.
 * Kept internal — normalized to ToolManifest before leaving this package.
 */
export interface RawMcpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

// ─── IToolExecutor ────────────────────────────────────────────────────────────

/**
 * IToolExecutor — the abstraction that decouples the ExecutionLoop
 * from any specific tool implementation (internal registry or MCP client).
 *
 * Both ToolRegistry and McpClient implement this interface.
 * The ExecutionLoop depends only on this interface — never on the concrete type.
 *
 * This is the key abstraction that enables progressive migration:
 *   Today:  ExecutionLoop → ToolRegistry (internal)
 *   Future: ExecutionLoop → McpClient    (MCP protocol)
 */
export interface IToolExecutor {
  /**
   * Executes a tool by name with the given input.
   * Returns a normalized ToolResult — never raw MCP types.
   */
  execute(
    name: string,
    input: Record<string, unknown>
  ): Promise<NormalizedToolResult>;

  /**
   * Returns true if the tool is available.
   */
  has(name: string): boolean;

  /**
   * Returns all available tool names.
   */
  listNames(): string[];

  /**
   * Returns tool manifests for the planner.
   */
  getManifests(): ToolManifest[];
}

// ─── Normalized Tool Result ───────────────────────────────────────────────────

/**
 * Normalized tool result — the internal OpsMind format.
 * This is what the ExecutionLoop receives, regardless of whether
 * the tool ran internally or via MCP protocol.
 */
export type NormalizedToolResult =
  | NormalizedToolSuccess
  | NormalizedToolFailure;

export interface NormalizedToolSuccess {
  success: true;
  data: Record<string, unknown>;
  durationMs: number;
  source: "internal" | "mcp";
}

export interface NormalizedToolFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  durationMs: number;
  source: "internal" | "mcp";
}
