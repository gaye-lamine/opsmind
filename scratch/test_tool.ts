import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import { MongoDbQueryTool } from "../packages/tools/mongodb-mcp/mongodb-query.tool";
import { getMongoDbMcpClient, initializeMongoDbMcpClient } from "@opsmind/mcp-client";

async function main() {
  await initializeMongoDbMcpClient({ connectionString: process.env.MONGODB_URI as string });
  const mcpClient = getMongoDbMcpClient();

  const tool = new MongoDbQueryTool();
  
  // Fake the MCP client connection
  const input = {
    operation: "find" as const,
    database: "opsmind",
    collection: "metrics",
    filter: { type: "churn" },
    limit: 5
  };

  try {
    const res = await tool.execute(input);
    console.log("TOOL RESULT:");
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("ERROR:", err);
  }
}

main();
