import { type ToolManifest } from "@opsmind/shared";
import {
  type RawMcpCallResult,
  type RawMcpTool,
  type NormalizedToolResult,
} from "../types/mcp-client.types";

/**
 * MCP Response Parser — the ONLY place where MCP wire types are transformed
 * into OpsMind internal types.
 *
 * This is the protocol boundary. Nothing from @modelcontextprotocol/sdk
 * leaks past this file into the rest of the system.
 *
 * Responsibilities:
 * - Parse tools/call responses → NormalizedToolResult
 * - Parse tools/list responses → ToolManifest[]
 * - Handle isError: true → NormalizedToolFailure
 * - Handle malformed JSON → NormalizedToolFailure with context
 */
export class McpResponseParser {
  /**
   * Parses a raw MCP tools/call result into a NormalizedToolResult.
   *
   * MCP returns content as an array of text blocks. The first text block
   * is expected to contain JSON. If it's not valid JSON, we return a failure.
   */
  static parseToolResult(
    raw: RawMcpCallResult,
    durationMs: number
  ): NormalizedToolResult {
    // Extract text content from the first text block
    const textBlock = raw.content.find((c) => c.type === "text");
    const rawText = textBlock?.text ?? "";

    // If MCP flagged this as an error, parse the error details
    if (raw.isError === true) {
      let errorDetails: Record<string, unknown> = { rawText };

      try {
        const parsed = JSON.parse(rawText) as Record<string, unknown>;
        errorDetails = parsed;
      } catch {
        // rawText is not JSON — use as-is in message
      }

      const message =
        typeof errorDetails["message"] === "string"
          ? errorDetails["message"]
          : rawText || "MCP tool returned an error";

      const code =
        typeof errorDetails["error"] === "string"
          ? errorDetails["error"]
          : "MCP_TOOL_ERROR";

      return {
        success: false,
        error: { code, message, details: errorDetails },
        durationMs,
        source: "mcp",
      };
    }

    // Parse the JSON response
    if (!rawText.trim()) {
      return {
        success: false,
        error: {
          code: "MCP_EMPTY_RESPONSE",
          message: "MCP tool returned an empty response",
        },
        durationMs,
        source: "mcp",
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Not JSON — wrap the raw text as a string result
      // Some MCP tools return plain text (e.g. schema descriptions)
      return {
        success: true,
        data: { result: rawText, format: "text" },
        durationMs,
        source: "mcp",
      };
    }

    // Ensure the parsed result is an object
    if (typeof parsed !== "object" || parsed === null) {
      return {
        success: true,
        data: { result: parsed, format: "primitive" },
        durationMs,
        source: "mcp",
      };
    }

    return {
      success: true,
      data: parsed as Record<string, unknown>,
      durationMs,
      source: "mcp",
    };
  }

  /**
   * Parses a raw MCP tools/list result into ToolManifest[].
   *
   * Normalizes the MCP tool definition format to the OpsMind ToolManifest format.
   * Unknown or malformed tools are skipped with a warning.
   */
  static parseToolManifests(rawTools: RawMcpTool[]): ToolManifest[] {
    return rawTools
      .filter((t) => typeof t.name === "string" && t.name.length > 0)
      .map((t) => ({
        name: t.name,
        description: t.description ?? `MCP tool: ${t.name}`,
        category: inferCategory(t.name),
        inputSchema: t.inputSchema ?? { type: "object", properties: {} },
      }));
  }
}

/**
 * Infers the OpsMind tool category from the MongoDB MCP Server tool name.
 * This allows the planner to reason about tool capabilities correctly.
 */
function inferCategory(toolName: string): ToolManifest["category"] {
  // Atlas management tools
  if (toolName.startsWith("atlas-")) return "system";

  // Read operations
  if (
    toolName === "find" ||
    toolName === "aggregate" ||
    toolName === "count" ||
    toolName === "explain" ||
    toolName === "list-databases" ||
    toolName === "list-collections" ||
    toolName === "collection-schema" ||
    toolName === "collection-indexes" ||
    toolName === "collection-storage-size" ||
    toolName === "db-stats" ||
    toolName === "mongodb-logs" ||
    toolName === "export" ||
    toolName === "connect" ||
    toolName === "switch-connection"
  ) {
    return "memory_read";
  }

  // Write operations
  if (
    toolName === "insert-many" ||
    toolName === "update-one" ||
    toolName === "update-many" ||
    toolName === "delete-many" ||
    toolName === "create-collection" ||
    toolName === "drop-collection" ||
    toolName === "drop-database" ||
    toolName === "rename-collection" ||
    toolName === "create-index" ||
    toolName === "drop-index"
  ) {
    return "memory_write";
  }

  return "system";
}
