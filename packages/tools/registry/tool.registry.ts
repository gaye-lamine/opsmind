import { createLogger, ToolError, ERROR_CODES } from "@opsmind/shared";
import {
  type ToolDefinition,
  type ToolManifest,
  type ToolCategory,
  type ToolResult,
} from "./tool.interface";

const logger = createLogger("ToolRegistry");

/**
 * Tool Registry — the agent's capability discovery system.
 *
 * The registry is the single source of truth for all tools available
 * to the agent during reasoning. The planner queries the registry to
 * understand what actions are possible, and the execution loop invokes
 * tools through the registry.
 *
 * Rule (ENGINEERING_RULES §6.3): All external capabilities MUST be exposed
 * through MCP tools and registries.
 *
 * Usage:
 *   const registry = ToolRegistry.getInstance()
 *   registry.register(new ReadStateTool())
 *   const tool = registry.get('read_operational_state')
 *   const result = await registry.execute('read_operational_state', input)
 */
export class ToolRegistry {
  private static instance: ToolRegistry | null = null;

  private readonly tools = new Map<
    string,
    ToolDefinition<Record<string, unknown>, Record<string, unknown>>
  >();

  private constructor() {}

  static getInstance(): ToolRegistry {
    if (ToolRegistry.instance === null) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * Registers a tool. Throws if a tool with the same name is already registered.
   */
  register(
    tool: ToolDefinition<Record<string, unknown>, Record<string, unknown>>
  ): void {
    if (this.tools.has(tool.name)) {
      throw new ToolError(
        `Tool "${tool.name}" is already registered`,
        ERROR_CODES.TOOL_NOT_FOUND,
        { toolName: tool.name }
      );
    }

    this.tools.set(tool.name, tool);
    logger.debug("Tool registered", { toolName: tool.name, category: tool.category });
  }

  /**
   * Retrieves a tool by name. Throws if not found.
   */
  get(
    name: string
  ): ToolDefinition<Record<string, unknown>, Record<string, unknown>> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolError(
        `Tool "${name}" not found in registry`,
        ERROR_CODES.TOOL_NOT_FOUND,
        { toolName: name, available: this.listNames() }
      );
    }
    return tool;
  }

  /**
   * Executes a tool by name with the given input.
   * This is the primary execution path used by the agent's execution loop.
   */
  async execute(
    name: string,
    input: Record<string, unknown>
  ): Promise<ToolResult<Record<string, unknown>>> {
    const tool = this.get(name);

    logger.debug("Executing tool", { toolName: name });

    const result = await tool.execute(input);

    if (result.success) {
      logger.debug("Tool executed successfully", {
        toolName: name,
        durationMs: result.durationMs,
      });
    } else {
      logger.warn("Tool execution failed", {
        toolName: name,
        error: result.error,
        durationMs: result.durationMs,
      });
    }

    return result;
  }

  /**
   * Returns all tool manifests — used by the planner to select appropriate tools.
   */
  getManifests(): ToolManifest[] {
    return Array.from(this.tools.values()).map((t) => t.toManifest());
  }

  /**
   * Returns manifests filtered by category — used for targeted tool selection.
   */
  getManifestsByCategory(category: ToolCategory): ToolManifest[] {
    return Array.from(this.tools.values())
      .filter((t) => t.category === category)
      .map((t) => t.toManifest());
  }

  /**
   * Returns all registered tool names.
   */
  listNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Checks if a tool is registered.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Returns the count of registered tools.
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Resets the registry — only for use in tests.
   */
  reset(): void {
    this.tools.clear();
    logger.debug("Tool registry reset");
  }
}

/**
 * Returns the singleton tool registry instance.
 */
export function getToolRegistry(): ToolRegistry {
  return ToolRegistry.getInstance();
}
