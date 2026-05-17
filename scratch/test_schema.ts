import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import { getMongoDbMcpClient, initializeMongoDbMcpClient } from "@opsmind/mcp-client";

async function main() {
  await initializeMongoDbMcpClient({ connectionString: process.env.MONGODB_URI as string });
  const mcpClient = getMongoDbMcpClient();
  
  // Get tools list
  const toolsResponse = await mcpClient.execute("list_tools", {}); // wait, standard MCP has listTools
  console.log("We need to inspect the 'aggregate' tool schema.");
}

main();
