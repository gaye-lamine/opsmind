import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { type Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { createLogger } from "@opsmind/shared";
import { McpToolRegistry } from "../registry/mcp-tool-registry";

const logger = createLogger("McpServer");

const SERVER_NAME = "opsmind-mcp-server";
const SERVER_VERSION = "1.0.0";

/**
 * OpsMind MCP Server — the protocol boundary layer.
 *
 * This class owns the MCP SDK Server instance and wires it to the
 * McpToolRegistry. It handles the two core MCP request types:
 *
 *   tools/list  → returns all available OpsMind tools as MCP Tool Definitions
 *   tools/call  → executes a tool via the McpToolRegistry handler
 *
 * Design principles:
 * - Stateless: no session state, no agent state, no workflow state
 * - Protocol-oriented: only speaks MCP JSON-RPC 2.0
 * - Transport-agnostic: accepts any Transport implementation
 * - Decoupled: knows nothing about Gemini, orchestrator, or agent runtime
 *
 * The McpServer does NOT:
 * - Import @opsmind/agent or @opsmind/ai
 * - Know about the reasoning pipeline
 * - Manage MongoDB connections (done in bootstrap before server starts)
 * - Contain business logic
 *
 * Transport extensibility:
 * The connect(transport) method accepts any SDK-compatible transport.
 * Switching from stdio to SSE/HTTP/WebSocket requires only changing
 * which transport is passed — this class is unchanged.
 */
export class McpServerInstance {
  private readonly server: Server;
  private readonly registry: McpToolRegistry;

  constructor(registry: McpToolRegistry) {
    this.registry = registry;

    this.server = new Server(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerHandlers();
  }

  /**
   * Connects the server to a transport and starts listening.
   * This is the only method that is transport-specific.
   *
   * For stdio:   connect(createStdioTransport())
   * For SSE:     connect(createSseTransport(req, res))   [future]
   * For HTTP:    connect(createHttpTransport(options))   [future]
   */
  async connect(transport: Transport): Promise<void> {
    logger.info("Connecting MCP server to transport", {
      serverName: SERVER_NAME,
      serverVersion: SERVER_VERSION,
      toolCount: this.registry.size,
    });

    await this.server.connect(transport);

    logger.info("MCP server connected and ready", {
      tools: this.registry.listTools().map((t) => t.tool.name),
    });
  }

  /**
   * Closes the server connection gracefully.
   */
  async close(): Promise<void> {
    logger.info("Closing MCP server...");
    await this.server.close();
    logger.info("MCP server closed");
  }

  // ─── Request Handlers ───────────────────────────────────────────────────────

  private registerHandlers(): void {
    this.registerListToolsHandler();
    this.registerCallToolHandler();
  }

  /**
   * tools/list — returns all available tools to the MCP client.
   *
   * Called by the client during capability discovery (after initialize).
   * Returns the full list of MCP Tool Definitions adapted from OpsMind BaseTool.
   */
  private registerListToolsHandler(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, () => {
      const tools = this.registry.listTools().map((def) => def.tool);

      logger.debug("tools/list requested", { count: tools.length });

      return { tools };
    });
  }

  /**
   * tools/call — executes a tool by name with the provided arguments.
   *
   * Validates that the tool exists, delegates to the McpToolRegistry handler
   * (which delegates to BaseTool.execute()), and returns the MCP-formatted result.
   *
   * Error handling:
   * - Unknown tool → returns isError: true with a descriptive message
   * - Tool execution failure → BaseTool returns ToolFailure, adapter serializes it
   * - Unexpected exception → caught here, returned as isError: true
   */
  private registerCallToolHandler(): void {
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request): Promise<CallToolResult> => {
        const { name, arguments: args } = request.params;

        logger.info("tools/call received", { toolName: name });

        const toolDef = this.registry.getTool(name);

        if (toolDef === undefined) {
          const available = this.registry
            .listTools()
            .map((t) => t.tool.name)
            .join(", ");

          logger.warn("tools/call — unknown tool", { name, available });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "TOOL_NOT_FOUND",
                  message: `Tool "${name}" is not registered in the OpsMind MCP server.`,
                  availableTools: available,
                }),
              },
            ],
            isError: true,
          };
        }

        try {
          const result = await toolDef.handler(args ?? {});

          logger.info("tools/call completed", {
            toolName: name,
            isError: result.isError ?? false,
          });

          return result;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);

          logger.error("tools/call — unexpected error", error instanceof Error ? error : undefined, {
            toolName: name,
            error: message,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "TOOL_EXECUTION_ERROR",
                  message: `Unexpected error executing tool "${name}": ${message}`,
                }),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }
}
