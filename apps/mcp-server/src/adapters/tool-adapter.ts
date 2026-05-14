import { z, type ZodSchema, type ZodObject, type ZodRawShape } from "zod";
import { type ToolDefinition } from "@opsmind/tools";
import { type Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Tool Adapter — converts an OpsMind BaseTool into an MCP Tool Definition.
 *
 * This is the Protocol Boundary Layer between the internal tool system
 * and the MCP wire protocol. It is the ONLY place where the two worlds meet.
 *
 * Responsibilities:
 * - Convert BaseTool.inputSchema (Zod) → MCP inputSchema (JSON Schema)
 * - Map BaseTool metadata (name, description, category) → MCP Tool shape
 *
 * The adapter does NOT:
 * - Know about the agent runtime
 * - Know about workflows or sessions
 * - Contain any business logic
 * - Modify the BaseTool in any way
 *
 * Future transports (SSE, HTTP, WebSocket) reuse this adapter unchanged —
 * the JSON Schema output is transport-agnostic.
 */

// ─── JSON Schema Types ────────────────────────────────────────────────────────

export type JsonSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object"
  | "null";

export interface JsonSchemaProperty {
  type?: JsonSchemaType | JsonSchemaType[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JsonSchemaProperty;
  anyOf?: JsonSchemaProperty[];
  oneOf?: JsonSchemaProperty[];
  $ref?: string;
}

export interface McpInputSchema {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

// ─── MCP Tool Definition (extended with handler) ─────────────────────────────

/**
 * An MCP Tool Definition ready for registration in the MCP server.
 * Extends the SDK's Tool type with a typed execution handler.
 */
export interface McpToolDefinition {
  /** The MCP Tool shape as defined by the SDK */
  tool: Tool;
  /**
   * Execution handler — called by the MCP server when tools/call is received.
   * Delegates to the underlying BaseTool.execute() — no logic here.
   */
  handler: (args: Record<string, unknown>) => Promise<McpToolResult>;
}

export interface McpToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * Adapts a single OpsMind BaseTool into an MCP Tool Definition.
 *
 * The handler wraps BaseTool.execute() and serializes the result
 * into the MCP content format (array of text blocks).
 */
export function adaptToolToMcp(
  tool: ToolDefinition<Record<string, unknown>, Record<string, unknown>>
): McpToolDefinition {
  const inputSchema = buildJsonSchema(tool.inputSchema);

  const mcpTool: Tool = {
    name: tool.name,
    description: buildDescription(tool.description, tool.category),
    inputSchema,
  };

  const handler = async (
    args: Record<string, unknown>
  ): Promise<McpToolResult> => {
    const result = await tool.execute(args);

    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: result.error.code,
              message: result.error.message,
              ...(result.error.details !== undefined
                ? { details: result.error.details }
                : {}),
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  };

  return { tool: mcpTool, handler };
}

// ─── JSON Schema Builder ──────────────────────────────────────────────────────

/**
 * Converts a Zod schema to a JSON Schema object compatible with the MCP spec.
 *
 * Handles the Zod types used across all OpsMind tools:
 * - ZodObject → { type: "object", properties, required }
 * - ZodString → { type: "string" }
 * - ZodNumber → { type: "number" }
 * - ZodBoolean → { type: "boolean" }
 * - ZodEnum → { type: "string", enum: [...] }
 * - ZodArray → { type: "array", items: ... }
 * - ZodOptional → unwraps inner type
 * - ZodDefault → unwraps inner type, adds default
 * - ZodLiteral → { type: "string", enum: [value] }
 * - ZodDiscriminatedUnion → { oneOf: [...] }
 * - ZodUnion → { anyOf: [...] }
 */
function buildJsonSchema(schema: ZodSchema): McpInputSchema {
  const converted = zodToJsonSchemaProperty(schema);

  // The top-level schema for MCP must always be type: "object"
  if (converted.type === "object" && converted.properties !== undefined) {
    return {
      type: "object",
      properties: converted.properties,
      ...(converted.required !== undefined && converted.required.length > 0
        ? { required: converted.required }
        : {}),
      additionalProperties: false,
    };
  }

  // Fallback — should not happen for well-formed tool schemas
  return {
    type: "object",
    properties: {},
    additionalProperties: true,
  };
}

function zodToJsonSchemaProperty(schema: ZodSchema): JsonSchemaProperty {
  const def = (schema as { _def: { typeName: string } })._def;

  switch (def.typeName) {
    case "ZodString":
      return buildStringSchema(schema);

    case "ZodNumber":
    case "ZodCoerce":
      return buildNumberSchema(schema);

    case "ZodBoolean":
      return { type: "boolean" };

    case "ZodLiteral": {
      const literalDef = def as { typeName: string; value: unknown };
      const literalType = typeof literalDef.value;
      return {
        type: (literalType === "string"
          ? "string"
          : literalType === "number"
          ? "number"
          : "boolean") as JsonSchemaType,
        enum: [literalDef.value],
      };
    }

    case "ZodEnum": {
      const enumDef = def as { typeName: string; values: string[] };
      return {
        type: "string",
        enum: enumDef.values,
      };
    }

    case "ZodNativeEnum": {
      const nativeEnumDef = def as { typeName: string; values: Record<string, unknown> };
      return {
        type: "string",
        enum: Object.values(nativeEnumDef.values),
      };
    }

    case "ZodArray": {
      const arrayDef = def as { typeName: string; type: ZodSchema };
      return {
        type: "array",
        items: zodToJsonSchemaProperty(arrayDef.type),
      };
    }

    case "ZodObject": {
      return buildObjectSchema(schema as ZodObject<ZodRawShape>);
    }

    case "ZodOptional": {
      const optionalDef = def as { typeName: string; innerType: ZodSchema };
      return zodToJsonSchemaProperty(optionalDef.innerType);
    }

    case "ZodDefault": {
      const defaultDef = def as {
        typeName: string;
        innerType: ZodSchema;
        defaultValue: () => unknown;
      };
      const inner = zodToJsonSchemaProperty(defaultDef.innerType);
      return {
        ...inner,
        default: defaultDef.defaultValue(),
      };
    }

    case "ZodNullable": {
      const nullableDef = def as { typeName: string; innerType: ZodSchema };
      const inner = zodToJsonSchemaProperty(nullableDef.innerType);
      return {
        anyOf: [inner, { type: "null" }],
      };
    }

    case "ZodUnion": {
      const unionDef = def as { typeName: string; options: ZodSchema[] };
      return {
        anyOf: unionDef.options.map(zodToJsonSchemaProperty),
      };
    }

    case "ZodDiscriminatedUnion": {
      const discDef = def as {
        typeName: string;
        options: ZodSchema[];
      };
      return {
        oneOf: discDef.options.map(zodToJsonSchemaProperty),
      };
    }

    case "ZodRecord": {
      const recordDef = def as {
        typeName: string;
        valueType: ZodSchema;
      };
      return {
        type: "object",
        additionalProperties: zodToJsonSchemaProperty(recordDef.valueType),
      };
    }

    case "ZodAny":
    case "ZodUnknown":
      return {};

    default:
      // Unknown Zod type — return permissive schema
      return {};
  }
}

function buildStringSchema(schema: ZodSchema): JsonSchemaProperty {
  const def = (schema as { _def: Record<string, unknown> })._def;
  const checks = (def["checks"] as Array<{ kind: string; value?: unknown }>) ?? [];

  const result: JsonSchemaProperty = { type: "string" };

  for (const check of checks) {
    if (check.kind === "min" && typeof check.value === "number") {
      result.minLength = check.value;
    }
    if (check.kind === "max" && typeof check.value === "number") {
      result.maxLength = check.value;
    }
  }

  return result;
}

function buildNumberSchema(schema: ZodSchema): JsonSchemaProperty {
  const def = (schema as { _def: Record<string, unknown> })._def;
  const checks = (def["checks"] as Array<{ kind: string; value?: unknown }>) ?? [];

  const result: JsonSchemaProperty = { type: "number" };

  for (const check of checks) {
    if (check.kind === "min" && typeof check.value === "number") {
      result.minimum = check.value;
    }
    if (check.kind === "max" && typeof check.value === "number") {
      result.maximum = check.value;
    }
    if (check.kind === "int") {
      result.type = "integer";
    }
  }

  return result;
}

function buildObjectSchema(schema: ZodObject<ZodRawShape>): JsonSchemaProperty {
  const shape = schema.shape;
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const fieldDef = (fieldSchema as { _def: { typeName: string } })._def;
    const isOptional =
      fieldDef.typeName === "ZodOptional" ||
      fieldDef.typeName === "ZodDefault";

    properties[key] = zodToJsonSchemaProperty(fieldSchema as ZodSchema);

    if (!isOptional) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * Enriches the tool description with its category for better MCP client UX.
 * The category helps external clients (Claude, Cursor, etc.) understand
 * the tool's purpose without knowing OpsMind internals.
 */
function buildDescription(description: string, category: string): string {
  const categoryLabel: Record<string, string> = {
    memory_read:  "[Memory Read]",
    memory_write: "[Memory Write]",
    analytics:    "[Analytics]",
    business:     "[Business Intelligence]",
    system:       "[System]",
  };

  const label = categoryLabel[category] ?? `[${category}]`;
  return `${label} ${description}`;
}
