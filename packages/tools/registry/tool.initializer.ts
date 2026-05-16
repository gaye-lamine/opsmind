import { createLogger } from "@opsmind/shared";
import { getToolRegistry } from "./tool.registry";
import { ReadStateTool } from "../mongodb/read-state/index";
import { WriteDecisionTool } from "../mongodb/write-decision/index";
import { UpdateMemoryTool } from "../mongodb/update-memory/index";
import { ActionLogTool } from "../mongodb/action-log/index";
import { MetricAnalyzerTool } from "../analytics/metric-analyzer";
import { DecisionRetrieverTool } from "../business/decision-retriever";
import { MongoDbQueryTool } from "../mongodb-mcp/mongodb-query.tool";
import { MongoDbSchemaTool } from "../mongodb-mcp/mongodb-schema.tool";
import { MongoDbPerformanceTool } from "../mongodb-mcp/mongodb-performance.tool";
import { MongoDbVectorSearchTool } from "../mongodb-mcp/mongodb-vector-search.tool";
import { MongoDbAnalyticsTool } from "../mongodb-mcp/mongodb-analytics.tool";
import { PublishAlertTool } from "../actions/publish-alert.tool";
import { UpdateStateTool } from "../actions/update-state.tool";
import { TriggerInvestigationTool } from "../actions/trigger-investigation.tool";
import { CreateGitlabIssueTool } from "../actions/create-gitlab-issue.tool";

const logger = createLogger("ToolInitializer");

/**
 * Registers all OpsMind tools into the tool registry.
 *
 * Called once at application bootstrap, before the agent runtime starts.
 * The order of registration does not matter — tools are looked up by name.
 *
 * To add a new tool:
 * 1. Implement it extending BaseTool
 * 2. Import it here
 * 3. Add registry.register(new YourTool()) below
 */
export function initializeTools(): void {
  const registry = getToolRegistry();

  logger.info("Initializing tool registry...");

  // ─── MongoDB Memory Tools (internal) ─────────────────────────────────────
  registry.register(new ReadStateTool() as never);
  registry.register(new WriteDecisionTool() as never);
  registry.register(new UpdateMemoryTool() as never);
  registry.register(new ActionLogTool() as never);

  // ─── Analytics Tools ──────────────────────────────────────────────────────
  registry.register(new MetricAnalyzerTool() as never);

  // ─── Business Intelligence Tools ──────────────────────────────────────────
  registry.register(new DecisionRetrieverTool() as never);

  // ─── MongoDB Atlas MCP Tools (via official MongoDB MCP Server) ────────────
  registry.register(new MongoDbQueryTool() as never);
  registry.register(new MongoDbSchemaTool() as never);
  registry.register(new MongoDbPerformanceTool() as never);
  registry.register(new MongoDbVectorSearchTool() as never);
  registry.register(new MongoDbAnalyticsTool() as never);

  // ─── Action Execution Tools (REAL ACTIONS in external systems) ────────────
  registry.register(new PublishAlertTool() as never);
  registry.register(new UpdateStateTool() as never);
  registry.register(new TriggerInvestigationTool() as never);
  registry.register(new CreateGitlabIssueTool() as never);

  logger.info("Tool registry initialized", {
    toolCount: registry.size,
    tools: registry.listNames(),
  });
}

/**
 * Returns a summary of all registered tools for the agent planner.
 * The planner uses this to decide which tools to invoke at each step.
 */
export function getToolManifestSummary(): string {
  const registry = getToolRegistry();
  const manifests = registry.getManifests();

  return manifests
    .map((m) => `- ${m.name} [${m.category}]: ${m.description}`)
    .join("\n");
}
