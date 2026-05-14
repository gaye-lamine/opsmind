/**
 * @opsmind/tools
 *
 * Action capability layer for OpsMind.
 *
 * This package exposes all tools available to the agent runtime.
 * The AI layer NEVER accesses MongoDB directly — it uses these tools.
 *
 * Architecture:
 * - tool.interface.ts  → BaseTool contract, ToolResult types
 * - tool.registry.ts   → Singleton registry for tool discovery and execution
 * - tool.initializer.ts → Registers all tools at bootstrap
 * - mongodb/           → MCP tools for operational memory access
 * - analytics/         → Business metric analysis tools
 * - business/          → Business intelligence and retrieval tools
 *
 * Dependency rule: imports from @opsmind/config, @opsmind/shared, @opsmind/memory only.
 * Never imports from @opsmind/agent or @opsmind/ai.
 *
 * Usage:
 *   import { initializeTools, getToolRegistry } from '@opsmind/tools'
 *
 *   // At application bootstrap (after connectDatabase):
 *   initializeTools()
 *
 *   // In the agent execution loop:
 *   const registry = getToolRegistry()
 *   const result = await registry.execute('read_operational_state', { mode: 'current' })
 */

// ─── Tool Interface & Base ────────────────────────────────────────────────────
export {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolDefinition,
  type ToolResult,
  type ToolSuccess,
  type ToolFailure,
  type ToolCategory,
  type ToolManifest,
  type ToolExecutionContext,
} from "../registry/tool.interface";

// ─── Tool Registry ────────────────────────────────────────────────────────────
export {
  ToolRegistry,
  getToolRegistry,
} from "../registry/tool.registry";

// ─── Tool Initializer ─────────────────────────────────────────────────────────
export {
  initializeTools,
  getToolManifestSummary,
} from "../registry/tool.initializer";

// ─── MongoDB Tools ────────────────────────────────────────────────────────────
export { ReadStateTool } from "../mongodb/read-state/index";
export { WriteDecisionTool } from "../mongodb/write-decision/index";
export { UpdateMemoryTool } from "../mongodb/update-memory/index";
export { ActionLogTool } from "../mongodb/action-log/index";

// ─── Analytics Tools ──────────────────────────────────────────────────────────
export { MetricAnalyzerTool } from "../analytics/metric-analyzer";

// ─── Business Tools ───────────────────────────────────────────────────────────
export { DecisionRetrieverTool } from "../business/decision-retriever";

// ─── MongoDB Atlas MCP Tools ──────────────────────────────────────────────────
export { MongoDbQueryTool } from "../mongodb-mcp/mongodb-query.tool";
export { MongoDbSchemaTool } from "../mongodb-mcp/mongodb-schema.tool";
export { MongoDbPerformanceTool } from "../mongodb-mcp/mongodb-performance.tool";

// ─── Action Execution Tools (REAL ACTIONS) ────────────────────────────────────
export { PublishAlertTool } from "../actions/publish-alert.tool";
export { UpdateStateTool } from "../actions/update-state.tool";
export { TriggerInvestigationTool } from "../actions/trigger-investigation.tool";
