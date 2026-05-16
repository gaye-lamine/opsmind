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
  const baseUrl = config.baseUrl || "https://gitlab.com/api/v4/mcp/";
  
  // We use npx mcp-remote to bridge the HTTP GitLab MCP to our Stdio client
  const args: string[] = [
    "-y",
    "mcp-remote@latest",
    baseUrl,
  ];

  const env: Record<string, string> = {
    NPM_CONFIG_PROGRESS: "false",
  };

  // If a token is provided, we might need to pass it.
  // Note: mcp-remote usually handles OAuth, but for a headless agent, 
  // we might need a custom approach or pre-authenticated state.
  if (config.token) {
    env.GITLAB_TOKEN = config.token;
  }

  return new McpClient({
    command: "npx",
    args,
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
