import { createLogger } from "@opsmind/shared";
import { getToolRegistry, type ToolDefinition } from "@opsmind/tools";
import {
  adaptToolToMcp,
  type McpToolDefinition,
} from "../adapters/tool-adapter";

const logger = createLogger("McpToolRegistry");

/**
 * MCP Tool Registry — bridges the OpsMind internal ToolRegistry and the MCP protocol.
 *
 * This registry is the single point of contact between:
 * - The internal @opsmind/tools ToolRegistry (source of truth for all tools)
 * - The MCP server (protocol layer)
 *
 * Responsibilities:
 * - Reads all registered tools from the internal ToolRegistry
 * - Adapts each BaseTool into an MCP Tool Definition via the ToolAdapter
 * - Provides tool listing (tools/list) and tool execution (tools/call) to the MCP server
 *
 * This registry does NOT:
 * - Know about the agent runtime, orchestrator, or workflows
 * - Contain any business logic
 * - Duplicate tool implementations
 * - Maintain its own tool state (stateless — delegates to internal registry)
 *
 * Design note: this class is intentionally decoupled from the MCP SDK transport.
 * The McpServer uses this registry regardless of transport (stdio, SSE, HTTP).
 * Future transports plug in without touching this class.
 */
export class McpToolRegistry {
  private readonly adapted = new Map<string, McpToolDefinition>();

  /**
   * Loads all tools from the internal OpsMind ToolRegistry and adapts them
   * to MCP Tool Definitions. Called once during server bootstrap.
   *
   * The internal ToolRegistry must be initialized (initializeTools() called)
   * before this method is invoked.
   */
  load(): void {
    const internalRegistry = getToolRegistry();
    const tools = internalRegistry.listNames();

    logger.info("Loading tools from internal registry into MCP registry", {
      toolCount: tools.length,
      tools,
    });

    for (const name of tools) {
      const tool = internalRegistry.get(name) as ToolDefinition<
        Record<string, unknown>,
        Record<string, unknown>
      >;

      const adapted = adaptToolToMcp(tool);
      this.adapted.set(name, adapted);

      logger.debug("Tool adapted for MCP", {
        name: adapted.tool.name,
        category: tool.category,
      });
    }

    logger.info("MCP tool registry loaded", {
      adaptedCount: this.adapted.size,
    });
  }

  /**
   * Returns all MCP Tool Definitions for the tools/list response.
   * Called by the MCP server to respond to client capability discovery.
   */
  listTools(): McpToolDefinition[] {
    return Array.from(this.adapted.values());
  }

  /**
   * Returns a single MCP Tool Definition by name.
   * Returns undefined if the tool is not registered.
   */
  getTool(name: string): McpToolDefinition | undefined {
    return this.adapted.get(name);
  }

  /**
   * Checks whether a tool is registered.
   */
  hasTool(name: string): boolean {
    return this.adapted.has(name);
  }

  /**
   * Returns the count of registered MCP tools.
   */
  get size(): number {
    return this.adapted.size;
  }
}
