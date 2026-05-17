import { McpClient } from "../client/mcp-client";
import { type MongoDbMcpConfig } from "../types/mcp-client.types";

/**
 * MongoDB MCP Client Factory — creates a pre-configured McpClient
 * that connects to the official MongoDB MCP Server.
 *
 * The MongoDB MCP Server is spawned as a child process via npx.
 * It connects to MongoDB Atlas using the provided connection string
 * and optionally the Atlas service account credentials.
 *
 * Usage:
 *   const client = createMongoDbMcpClient({
 *     connectionString: process.env.MONGODB_URI,
 *     atlasClientId: process.env.ATLAS_MCP_CLIENT_ID,
 *     atlasClientSecret: process.env.ATLAS_MCP_CLIENT_SECRET,
 *   });
 *   await client.connect();
 *   const result = await client.execute("find", { ... });
 */
export function createMongoDbMcpClient(config: MongoDbMcpConfig): McpClient {
  const isProd = process.env.NODE_ENV === "production";
  
  const args: string[] = [
    "--connectionString",
    config.connectionString,
  ];

  // Add Atlas service account credentials if provided
  if (config.atlasClientId !== undefined && config.atlasClientSecret !== undefined) {
    args.push("--apiClientId", config.atlasClientId);
    args.push("--apiClientSecret", config.atlasClientSecret);
  }

  // Read-only mode by default for safety
  if (config.readOnly !== false) {
    args.push("--readOnly");
  }

  return new McpClient({
    command: isProd ? "mongodb-mcp-server" : "npx",
    args: isProd ? args : ["-y", "mongodb-mcp-server@latest", ...args],
    serverName: "mongodb-atlas-mcp",
    env: {
      NPM_CONFIG_PROGRESS: "false",
      ...process.env,
    },
  });
}

/**
 * Singleton MongoDB MCP client instance.
 * Initialized once at bootstrap, reused across all tool calls.
 */
let _mongoDbMcpClient: McpClient | null = null;

export function getMongoDbMcpClient(): McpClient {
  if (_mongoDbMcpClient === null) {
    throw new Error(
      "[McpClient] MongoDB MCP client not initialized. Call initializeMongoDbMcpClient() first."
    );
  }
  return _mongoDbMcpClient;
}

export async function initializeMongoDbMcpClient(
  config: MongoDbMcpConfig
): Promise<McpClient> {
  if (_mongoDbMcpClient !== null && _mongoDbMcpClient.isConnected) {
    return _mongoDbMcpClient;
  }

  _mongoDbMcpClient = createMongoDbMcpClient(config);
  await _mongoDbMcpClient.connect();
  return _mongoDbMcpClient;
}

export async function disconnectMongoDbMcpClient(): Promise<void> {
  if (_mongoDbMcpClient !== null) {
    await _mongoDbMcpClient.disconnect();
    _mongoDbMcpClient = null;
  }
}
