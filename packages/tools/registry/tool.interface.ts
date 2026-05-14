import { z, type ZodSchema } from "zod";

/**
 * MCP Tool Interface — the contract every tool in OpsMind must implement.
 *
 * The agent runtime uses this interface to:
 * 1. Discover available tools via the registry
 * 2. Understand tool capabilities (name, description, input schema)
 * 3. Execute tools with typed, validated inputs
 * 4. Receive typed, validated outputs
 *
 * Rule (ENGINEERING_RULES §6.3): AI NEVER directly accesses databases.
 * All external capabilities MUST be exposed through MCP tools.
 */

// ─── Tool Categories ──────────────────────────────────────────────────────────

export type ToolCategory =
  | "memory_read"    // Reads from MongoDB operational memory
  | "memory_write"   // Writes to MongoDB operational memory
  | "analytics"      // Business metric analysis
  | "business"       // Business intelligence operations
  | "system";        // System-level operations

// ─── Tool Definition ──────────────────────────────────────────────────────────

export interface ToolDefinition<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Unique tool identifier — used by the agent to select and invoke tools */
  name: string;
  /** Human-readable description — used by the planner to decide which tool to use */
  description: string;
  /** Category — used for tool filtering and selection strategy */
  category: ToolCategory;
  /** Zod schema for input validation — all inputs are validated before execution */
  inputSchema: ZodSchema<TInput>;
  /** Zod schema for output validation — all outputs are validated after execution */
  outputSchema: ZodSchema<TOutput>;
  /** Execute the tool with validated input */
  execute(input: TInput): Promise<ToolResult<TOutput>>;
}

// ─── Tool Result ──────────────────────────────────────────────────────────────

export type ToolResult<T extends Record<string, unknown>> =
  | ToolSuccess<T>
  | ToolFailure;

export interface ToolSuccess<T extends Record<string, unknown>> {
  success: true;
  data: T;
  durationMs: number;
}

export interface ToolFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  durationMs: number;
}

// ─── Tool Execution Context ───────────────────────────────────────────────────

export interface ToolExecutionContext {
  sessionId: string;
  stepId: string;
  toolCallId: string;
}

// ─── Tool Manifest (for agent tool selection) ─────────────────────────────────

export interface ToolManifest {
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: Record<string, unknown>;
}

// ─── Helper: build a ToolFailure ─────────────────────────────────────────────

export function toolFailure(
  code: string,
  message: string,
  durationMs: number,
  details?: Record<string, unknown>
): ToolFailure {
  return {
    success: false,
    error: { code, message, details },
    durationMs,
  };
}

export function toolSuccess<T extends Record<string, unknown>>(
  data: T,
  durationMs: number
): ToolSuccess<T> {
  return { success: true, data, durationMs };
}

// ─── Abstract base class for tools ───────────────────────────────────────────

export abstract class BaseTool<
  TInput extends Record<string, unknown>,
  TOutput extends Record<string, unknown>,
> implements ToolDefinition<TInput, TOutput>
{
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly category: ToolCategory;
  abstract readonly inputSchema: ZodSchema<TInput>;
  abstract readonly outputSchema: ZodSchema<TOutput>;

  /**
   * Public entry point — validates input, executes, validates output, times execution.
   */
  async execute(input: TInput): Promise<ToolResult<TOutput>> {
    const start = Date.now();

    // Validate input
    const inputResult = this.inputSchema.safeParse(input);
    if (!inputResult.success) {
      return toolFailure(
        "TOOL_INPUT_VALIDATION_FAILED",
        `Invalid input for tool ${this.name}: ${inputResult.error.message}`,
        Date.now() - start,
        { issues: inputResult.error.issues }
      );
    }

    // Execute
    let rawOutput: ToolResult<TOutput>;
    try {
      rawOutput = await this.run(inputResult.data);
    } catch (error) {
      return toolFailure(
        "TOOL_EXECUTION_FAILED",
        `Tool ${this.name} threw an unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        Date.now() - start,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }

    if (!rawOutput.success) {
      return { ...rawOutput, durationMs: Date.now() - start };
    }

    // Validate output
    const outputResult = this.outputSchema.safeParse(rawOutput.data);
    if (!outputResult.success) {
      return toolFailure(
        "TOOL_OUTPUT_VALIDATION_FAILED",
        `Tool ${this.name} produced invalid output: ${outputResult.error.message}`,
        Date.now() - start,
        { issues: outputResult.error.issues }
      );
    }

    return toolSuccess(outputResult.data, Date.now() - start);
  }

  /**
   * Internal implementation — override in each tool.
   * Input is already validated when this is called.
   */
  protected abstract run(input: TInput): Promise<ToolResult<TOutput>>;

  /**
   * Returns the tool manifest for agent tool selection.
   */
  toManifest(): ToolManifest {
    return {
      name: this.name,
      description: this.description,
      category: this.category,
      inputSchema: zodToJsonSchema(this.inputSchema),
    };
  }
}

/**
 * Minimal Zod → JSON Schema converter for tool manifests.
 * Used by the planner to understand tool input shapes.
 */
function zodToJsonSchema(schema: ZodSchema): Record<string, unknown> {
  // Use the Zod schema description as a lightweight representation
  // In production, replace with zod-to-json-schema package
  const shape = (schema as z.ZodObject<z.ZodRawShape>)._def;
  return {
    type: "object",
    description: shape.description ?? "",
  };
}
