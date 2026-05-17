import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createLogger } from "@opsmind/shared";
import { type ToolManifest } from "@opsmind/shared";
import {
  type IToolExecutor,
  type NormalizedToolResult,
  type StdioMcpServerConfig as McpServerConfig,
  type McpClientState,
  type RawMcpCallResult,
  type RawMcpTool,
} from "../types/mcp-client.types";
import { McpResponseParser } from "../response/mcp-response-parser";

const logger = createLogger("McpClient");

/**
 * McpClient — connects to an external MCP server via stdio transport
 * and exposes its tools through the IToolExecutor interface.
 */
export class McpClient implements IToolExecutor {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private cachedManifests: ToolManifest[] | null = null;
  private state: McpClientState;
  private readonly config: McpServerConfig;

  constructor(config: McpServerConfig) {
    this.config = config;
    this.state = {
      status: "disconnected",
      serverName: config.serverName,
      toolCount: 0,
    };
  }

  /**
   * Establishes the connection to the MCP server.
   * Spawns the server process and performs the MCP handshake.
   * Caches the tool manifests for subsequent calls.
   */
  async connect(): Promise<void> {
    if (this.state.status === "connected") {
      logger.debug("Already connected", { server: this.config.serverName });
      return;
    }

    this.state = { ...this.state, status: "connecting" };
    logger.info("Connecting to MCP server", {
      server: this.config.serverName,
      command: this.config.command,
      args: this.config.args,
    });

    try {
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: {
          ...process.env,
          ...(this.config.env ?? {}),
        } as Record<string, string>,
      });

      this.client = new Client(
        { name: "opsmind-agent", version: "1.0.0" },
        { capabilities: { tools: {} } }
      );

      await this.client.connect(this.transport);

      // Discover available tools
      const toolsResult = await this.client.listTools();
      const rawTools = (toolsResult.tools ?? []) as RawMcpTool[];
      this.cachedManifests = McpResponseParser.parseToolManifests(rawTools);

      this.state = {
        status: "connected",
        serverName: this.config.serverName,
        connectedAt: new Date(),
        toolCount: this.cachedManifests.length,
      };

      logger.info("MCP server connected", {
        server: this.config.serverName,
        toolCount: this.cachedManifests.length,
        tools: this.cachedManifests.map((t) => t.name),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state = {
        status: "error",
        serverName: this.config.serverName,
        toolCount: 0,
        error: message,
      };
      logger.error("Failed to connect to MCP server", error instanceof Error ? error : undefined, {
        server: this.config.serverName,
      });
      throw error;
    }
  }

  /**
   * Disconnects from the MCP server and cleans up resources.
   */
  async disconnect(): Promise<void> {
    if (this.client !== null) {
      try {
        await this.client.close();
      } catch {
        // Ignore close errors
      }
      this.client = null;
    }
    this.transport = null;
    this.cachedManifests = null;
    this.state = {
      status: "disconnected",
      serverName: this.config.serverName,
      toolCount: 0,
    };
    logger.info("MCP client disconnected", { server: this.config.serverName });
  }

  // ─── IToolExecutor implementation ─────────────────────────────────────────

  /**
   * Executes a tool via the MCP protocol.
   * Returns a NormalizedToolResult — never raw MCP types.
   */
  async execute(
    name: string,
    input: Record<string, unknown>
  ): Promise<NormalizedToolResult> {
    const start = Date.now();

    // Lazy load / Reconnect if disconnected
    if (this.client === null || this.state.status !== "connected") {
      logger.info(`Lazy reconnecting to MCP server: ${this.config.serverName}`);
      try {
        await this.connect();
      } catch (error) {
        return {
          success: false,
          error: {
            code: "MCP_NOT_CONNECTED",
            message: `MCP client failed to connect to ${this.config.serverName}: ${error instanceof Error ? error.message : String(error)}`,
          },
          durationMs: Date.now() - start,
          source: "mcp",
        };
      }
    }

    logger.debug("Executing MCP tool", {
      server: this.config.serverName,
      toolName: name,
    });

    try {
      const rawResult = await this.client.callTool({
        name,
        arguments: input,
      });

      const durationMs = Date.now() - start;

      // Normalize the raw MCP result to OpsMind internal format
      const normalized = McpResponseParser.parseToolResult(
        rawResult as RawMcpCallResult,
        durationMs
      );

      logger.debug("MCP tool executed", {
        server: this.config.serverName,
        toolName: name,
        success: normalized.success,
        durationMs,
      });

      return normalized;
    } catch (error) {
      const durationMs = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);

      logger.error("MCP tool execution failed", error instanceof Error ? error : undefined, {
        server: this.config.serverName,
        toolName: name,
      });

      return {
        success: false,
        error: {
          code: "MCP_EXECUTION_ERROR",
          message: `MCP tool "${name}" failed: ${message}`,
        },
        durationMs,
        source: "mcp",
      };
    }
  }

  /**
   * Returns true if the tool is available on the connected server.
   */
  has(name: string): boolean {
    if (this.cachedManifests === null) return false;
    return this.cachedManifests.some((m) => m.name === name);
  }

  /**
   * Returns all available tool names.
   */
  listNames(): string[] {
    if (this.cachedManifests === null) return [];
    return this.cachedManifests.map((m) => m.name);
  }

  /**
   * Returns tool manifests for the planner.
   */
  getManifests(): ToolManifest[] {
    return this.cachedManifests ?? [];
  }

  /**
   * Returns the current connection state.
   */
  getState(): Readonly<McpClientState> {
    return this.state;
  }

  /**
   * Returns true if the client is connected and ready.
   */
  get isConnected(): boolean {
    return this.state.status === "connected" && this.client !== null;
  }
}
