import { McpClient } from "../client/mcp-client";

/**
 * GitLab MCP Client Factory — creates a pre-configured McpClient
 * that connects to the official GitLab MCP Server.
 * 
 * Since the current McpClient implementation uses Stdio transport,
 * we use the 'mcp-remote' proxy to connect to GitLab's HTTP MCP endpoint.
 * 
 * Prerequisites:
 * - A GitLab Personal Access Token (PAT) with 'api' scope.
 * - The GitLab Project ID or Path where actions will be performed.
 */
export function createGitLabMcpClient(config: {
  baseUrl?: string;
  token?: string;
}): McpClient {
  const isProd = process.env.NODE_ENV === "production";
  const baseUrl = config.baseUrl || "https://gitlab.com/api/v4/mcp/";
  
  const args: string[] = [baseUrl];

  if (config.token) {
    args.push("--header", `Authorization: Bearer ${config.token}`);
  }

  const env: Record<string, string> = {
    NPM_CONFIG_PROGRESS: "false",
  };

  return new McpClient({
    command: isProd ? "mcp-remote" : "npx",
    args: isProd ? args : ["-y", "mcp-remote@latest", ...args],
    serverName: "gitlab-mcp",
    env,
  });
}

let _gitlabMcpClient: McpClient | null = null;

export function getGitLabMcpClient(): McpClient {
  if (_gitlabMcpClient === null) {
    throw new Error(
      "[McpClient] GitLab MCP client not initialized."
    );
  }
  return _gitlabMcpClient;
}

export async function initializeGitLabMcpClient(config: {
  token?: string;
  baseUrl?: string;
}): Promise<McpClient> {
  if (_gitlabMcpClient !== null && _gitlabMcpClient.isConnected) {
    return _gitlabMcpClient;
  }

  _gitlabMcpClient = createGitLabMcpClient(config);
  await _gitlabMcpClient.connect();
  return _gitlabMcpClient;
}

export async function disconnectGitLabMcpClient(): Promise<void> {
  if (_gitlabMcpClient !== null) {
    await _gitlabMcpClient.disconnect();
    _gitlabMcpClient = null;
  }
}
