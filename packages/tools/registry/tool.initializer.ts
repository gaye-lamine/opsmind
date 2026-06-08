import { createLogger } from "@opsmind/shared";
import { getToolRegistry } from "./tool.registry";
import { ReadStateTool } from "../mongodb/read-state/index";
import { WriteDecisionTool } from "../mongodb/write-decision/index";
import { UpdateMemoryTool } from "../mongodb/update-memory/index";
import { ActionLogTool } from "../mongodb/action-log/index";
import { MetricAnalyzerTool } from "../analytics/metric-analyzer";
import { DecisionRetrieverTool } from "../business/decision-retriever";
import { AgentBuilderSearchTool } from "../business/agent-builder-search.tool";
import { MongoDbQueryTool } from "../mongodb-mcp/mongodb-query.tool";
import { MongoDbSchemaTool } from "../mongodb-mcp/mongodb-schema.tool";
import { MongoDbPerformanceTool } from "../mongodb-mcp/mongodb-performance.tool";
import { MongoDbVectorSearchTool } from "../mongodb-mcp/mongodb-vector-search.tool";
import { MongoDbAnalyticsTool } from "../mongodb-mcp/mongodb-analytics.tool";
import { MongoDbListCollectionsTool } from "../mongodb-mcp/mongodb-list-collections.tool";
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
  registry.register(new ReadStateTool());
  registry.register(new WriteDecisionTool());
  registry.register(new UpdateMemoryTool());
  registry.register(new ActionLogTool());

  // ─── Analytics Tools ──────────────────────────────────────────────────────
  registry.register(new MetricAnalyzerTool());

  // ─── Business Intelligence Tools ──────────────────────────────────────────
  registry.register(new DecisionRetrieverTool());
  registry.register(new AgentBuilderSearchTool());

  // ─── MongoDB Atlas MCP Tools (via official MongoDB MCP Server) ────────────
  registry.register(new MongoDbQueryTool());
  registry.register(new MongoDbSchemaTool());
  registry.register(new MongoDbPerformanceTool());
  registry.register(new MongoDbVectorSearchTool());
  registry.register(new MongoDbAnalyticsTool());
  registry.register(new MongoDbListCollectionsTool());

  // ─── Action Execution Tools (REAL ACTIONS in external systems) ────────────
  registry.register(new PublishAlertTool());
  registry.register(new UpdateStateTool());
  registry.register(new TriggerInvestigationTool());
  registry.register(new CreateGitlabIssueTool());

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
