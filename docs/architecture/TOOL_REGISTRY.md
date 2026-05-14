# OpsMind — Tool Registry

## Overview

The tool registry is the agent's capability discovery system. The AI layer **never** accesses databases directly — it invokes tools through the registry. This enforces the MCP (Model Context Protocol) pattern: all external capabilities are exposed through typed, validated interfaces.

---

## Architecture

```
Agent Orchestrator
       │
       ▼
  PlannerEngine          → queries registry.getManifests() to know available tools
       │
       ▼
  ExecutionLoop          → calls registry.execute(toolName, input)
       │
       ▼
  ToolRegistry           → resolves tool, delegates to BaseTool.execute()
       │
       ▼
  BaseTool               → validates input (Zod), runs tool, validates output (Zod)
       │
       ▼
  MongoDB / Analytics    → actual data access
```

---

## Tool Interface

Every tool implements `BaseTool<TInput, TOutput>`:

```typescript
abstract class BaseTool<TInput, TOutput> {
  abstract name: string           // unique identifier used by the planner
  abstract description: string    // used by Gemini to decide which tool to use
  abstract category: ToolCategory // memory_read | memory_write | analytics | business | system
  abstract inputSchema: ZodSchema<TInput>
  abstract outputSchema: ZodSchema<TOutput>

  // Public entry point — validates input, executes, validates output
  async execute(input: TInput): Promise<ToolResult<TOutput>>

  // Override in each tool — input is already validated
  protected abstract run(input: TInput): Promise<ToolResult<TOutput>>
}
```

**Execution guarantees:**
- Input is always Zod-validated before `run()` is called
- Output is always Zod-validated before returning to the caller
- Exceptions in `run()` are caught and returned as `ToolFailure`
- Execution time is always measured and included in the result

---

## Registered Tools

### MongoDB Memory Tools

#### `read_operational_state`
- **Category:** `memory_read`
- **Description:** Reads the current operational business state from memory. Returns business metrics, detected anomalies, and active investigations.
- **Modes:** `current` (latest snapshot), `history` (N recent snapshots), `range` (time range)
- **Use when:** Starting any investigation to understand the current situation

**Input:**
```typescript
{
  mode: "current" | "history" | "range",
  limit?: number,    // for "history" mode
  from?: string,     // ISO datetime, for "range" mode
  to?: string        // ISO datetime, for "range" mode
}
```

**Output:**
```typescript
{
  mode: string,
  snapshots: StateSnapshot[],
  totalCount: number,
  hasAnomalies: boolean,
  criticalAnomalyCount: number
}
```

---

#### `write_decision`
- **Category:** `memory_write`
- **Description:** Persists a structured decision to operational memory. Builds organizational memory that improves future decision-making.
- **Use when:** After completing reasoning to store findings and recommendations

**Input:**
```typescript
{
  sessionId: string,
  goal: string,
  category: DecisionCategory,
  summary: string,
  reasoning: string,
  findings: Finding[],
  recommendations: Recommendation[],
  confidenceScore: number,
  toolsUsed: string[],
  memoryReferences: string[],
  reasoningSteps: ReasoningStep[],
  modelUsed: string
}
```

**Output:**
```typescript
{
  decisionId: string,
  status: string,
  confidenceLevel: string,
  findingsCount: number,
  recommendationsCount: number,
  persistedAt: string
}
```

---

#### `update_memory`
- **Category:** `memory_write`
- **Description:** Updates operational memory during agent execution. Three operations available.
- **Operations:**
  - `update_state` — resolve anomalies, add/remove investigations, update last decision
  - `update_session_step` — track agent progress through the pipeline
  - `finalize_decision` — attach reflection and finalize a decision

---

#### `action_log`
- **Category:** `memory_write`
- **Description:** Logs execution events and tracks action outcomes. Four operations available.
- **Operations:**
  - `log_execution` — record a pipeline step event
  - `log_error` — record a failure with full context
  - `record_action_outcome` — close the feedback loop after action completion
  - `update_action_status` — track action progress

---

### Analytics Tools

#### `analyze_metrics`
- **Category:** `analytics`
- **Description:** Analyzes business metrics for trends, patterns, and anomalies. Reads historical operational state and computes statistical analysis.
- **Algorithm:** Z-score anomaly detection (configurable threshold, default 2.0σ)
- **Use when:** Investigating metric anomalies or understanding business health

**Input:**
```typescript
{
  metricNames: string[],      // empty = analyze all metrics
  historyDepth: number,       // default 5 snapshots
  detectAnomalies: boolean,   // default true
  anomalyThreshold: number    // z-score threshold, default 2.0
}
```

**Output:**
```typescript
{
  analyzedMetrics: MetricTrend[],
  detectedAnomalies: DetectedAnomaly[],
  anomalyCount: number,
  criticalAnomalyCount: number,
  overallHealthScore: number,  // 0–1
  analysisTimestamp: string
}
```

---

### Business Intelligence Tools

#### `retrieve_decisions`
- **Category:** `memory_read`
- **Description:** Retrieves historical decisions from organizational memory. Provides pattern insights from past decisions.
- **Modes:** `recent`, `by_category`, `by_metric`, `by_session`
- **Use when:** Understanding historical precedents for similar problems

**Output includes `patternInsights`:** automatically extracted patterns from retrieved decisions (average confidence, dominant category, action success rate).

---

## Adding a New Tool

1. Create a new file in the appropriate subdirectory (`mongodb/`, `analytics/`, `business/`)
2. Extend `BaseTool<TInput, TOutput>`
3. Define `inputSchema` and `outputSchema` as Zod schemas
4. Implement `protected run(input: TInput): Promise<ToolResult<TOutput>>`
5. Register in `packages/tools/registry/tool.initializer.ts`

```typescript
// Example
export class MyNewTool extends BaseTool<MyInput, MyOutput> {
  readonly name = "my_new_tool";
  readonly description = "What this tool does and when to use it";
  readonly category = "analytics" as const;
  readonly inputSchema = myInputSchema;
  readonly outputSchema = myOutputSchema;

  protected async run(input: MyInput): Promise<ToolResult<MyOutput>> {
    // implementation
    return toolSuccess({ ... }, 0);
  }
}

// In tool.initializer.ts:
registry.register(new MyNewTool() as never);
```

---

## Tool Selection by the Planner

The `PlannerEngine` sends all tool manifests to Gemini as part of the planning prompt:

```
Available Tools:
- read_operational_state [memory_read]: Reads the current operational business state...
- write_decision [memory_write]: Persists a structured decision to operational memory...
- analyze_metrics [analytics]: Analyzes business metrics for trends and anomalies...
- retrieve_decisions [memory_read]: Retrieves historical decisions from organizational memory...
- update_memory [memory_write]: Updates operational memory during agent execution...
- action_log [memory_write]: Logs execution events and tracks action outcomes...
```

Gemini selects tools based on the description and the current reasoning step requirements. The planner validates that all selected tool names exist in the registry before returning the plan.
