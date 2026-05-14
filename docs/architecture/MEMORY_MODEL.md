# OpsMind — Memory Model

## Overview

MongoDB is not a simple database in OpsMind. It is the **operational memory substrate** — the system that makes the agent improve over time. Every important reasoning step is persisted. Future sessions retrieve this history to make better decisions.

---

## Collections

### `decisions`

The primary memory artifact. Every completed reasoning session produces one decision document.

```typescript
{
  _id: string,                    // generateDecisionId() → "decision_<uuid>"
  sessionId: string,              // parent session
  goal: string,                   // original user goal
  category: DecisionCategory,     // anomaly_resolution | strategic_recommendation | ...
  status: DecisionStatus,         // draft → pending_reflection → reflected → finalized
  summary: string,                // executive summary
  reasoning: string,              // full reasoning narrative
  findings: Finding[],            // structured findings with evidence
  recommendations: ActionRecommendation[],  // actionable recommendations
  reflection: DecisionReflection, // quality evaluation (mandatory)
  confidenceScore: number,        // 0–1, adjusted by reflection
  confidenceLevel: ConfidenceLevel, // low | medium | high | very_high
  reasoningTrace: ReasoningTrace, // full step-by-step trace with durations
  toolsUsed: string[],            // which MCP tools were invoked
  memoryReferences: string[],     // decision IDs used as context
  embedding: number[],            // optional: vector for semantic search
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ status: 1, createdAt: -1 }` — recent finalized decisions
- `{ category: 1, status: 1, createdAt: -1 }` — category-specific history
- `{ sessionId: 1 }` — session decisions
- `{ "findings.relatedMetrics": 1 }` — metric-based retrieval
- `{ embedding: 1 }` (sparse) — vector search

---

### `sessions`

Tracks the full lifecycle of each agent execution run.

```typescript
{
  _id: string,                    // generateSessionId() → "session_<uuid>"
  goal: string,
  category: GoalCategory,
  status: AgentSessionStatus,     // initializing → running → reflecting → completed | failed | timeout
  currentStep: string,            // current pipeline step
  stepCount: number,
  completedSteps: ReasoningStepResult[],  // full step history
  toolCalls: ToolCall[],          // all tool invocations with inputs/outputs
  decisionId: string,             // set on completion
  context: BusinessContext,       // domain, timeframe, metrics
  memoryReferences: string[],     // decision IDs used as context
  error: { code, message, step }, // set on failure
  startedAt: Date,
  completedAt: Date,
  durationMs: number
}
```

**Indexes:**
- `{ status: 1, startedAt: -1 }` — active/recent sessions
- `{ completedAt: -1 }` — recent completed sessions

---

### `operational_state`

Point-in-time snapshots of the business environment. **Append-only** — new snapshots are inserted, never updated. This creates a full history of how the business state evolved.

```typescript
{
  _id: string,
  snapshotAt: Date,
  isCurrent: boolean,             // only one document has isCurrent: true
  metrics: BusinessMetric[],      // name, value, unit, trend, changePercent, isAnomaly
  anomalies: DetectedAnomaly[],   // id, metric, severity, status, evidence
  activeInvestigations: string[], // session IDs currently running
  lastDecisionId: string,
  summary: string,
  source: "manual" | "agent" | "scheduled" | "seed"
}
```

**Key behavior:** When a new snapshot is inserted, the previous `isCurrent: true` document is atomically demoted to `isCurrent: false`. This ensures exactly one current state at all times.

**Indexes:**
- `{ isCurrent: 1 }` (partial) — fast current state lookup
- `{ snapshotAt: -1 }` — historical snapshots
- `{ "anomalies.metric": 1 }` — anomaly history by metric

---

### `actions`

Individual action recommendations, tracked independently from decisions. Enables lifecycle management and outcome recording.

```typescript
{
  _id: string,                    // generateActionId() → "action_<uuid>"
  decisionId: string,
  sessionId: string,
  title: string,
  description: string,
  rationale: string,
  priority: "low" | "medium" | "high" | "immediate",
  status: ActionStatus,           // recommended → acknowledged → in_progress → completed | dismissed
  estimatedImpact: string,
  timeframe: string,
  risks: string[],
  outcome: {                      // set when completed/dismissed
    wasSuccessful: boolean,
    notes: string,
    observedAt: Date,
    measuredImpact: string
  },
  statusHistory: StatusChange[],  // full audit trail of status changes
  createdAt: Date,
  updatedAt: Date
}
```

**Why separate from decisions:** Actions need independent tracking. A decision may have 5 recommendations — each can be in a different state. Outcome recording closes the feedback loop: future reasoning learns which action types led to successful outcomes.

**Indexes:**
- `{ decisionId: 1 }` — actions per decision
- `{ status: 1, priority: 1, createdAt: -1 }` — pending actions by priority

---

### `execution_logs`

Append-only audit trail of every significant event in the reasoning pipeline.

```typescript
{
  _id: string,                    // generateLogId() → "log_<uuid>"
  sessionId: string,
  level: "debug" | "info" | "warn" | "error",
  step: string,                   // pipeline step that generated this log
  message: string,
  data: Record<string, unknown>,  // structured context
  toolCallId: string,             // if associated with a tool call
  decisionId: string,             // if associated with a decision
  durationMs: number,
  error: { name, message, stack, code },  // for error-level logs
  timestamp: Date
}
```

**TTL index:** Debug logs are automatically deleted after 30 days. Info/warn/error logs are retained indefinitely.

**Indexes:**
- `{ sessionId: 1, timestamp: 1 }` — session replay
- `{ level: 1, timestamp: -1 }` — error analysis
- `{ step: 1, timestamp: -1 }` — step performance analysis

---

## Memory Retrieval Strategy

The `ContextAssembler` uses a multi-source retrieval strategy:

```
1. Current operational state    → what is the business situation right now?
2. Recent finalized decisions   → what did we decide recently?
3. Category-specific decisions  → what did we decide for similar problems?
4. Pending actions              → what are we already doing?
5. Completed actions + outcomes → what worked and what didn't?
```

Results are deduplicated and assembled into a `MemoryContext` object injected into every Gemini call. This gives the agent full organizational memory at each reasoning step.

---

## Vector Memory (Semantic Search)

When `VECTOR_SEARCH_ENABLED=true`, the `VectorStore` uses MongoDB Atlas Vector Search to find semantically similar past decisions — not just the most recent ones.

**Index definition (Atlas):**
```json
{
  "fields": [{
    "type": "vector",
    "path": "embedding",
    "numDimensions": 768,
    "similarity": "cosine"
  }]
}
```

**Fallback:** When vector search is disabled (local development), the system falls back to recency-based retrieval. The agent still works — it just uses temporal proximity instead of semantic similarity.

---

## Feedback Loop

The memory model creates a continuous improvement loop:

```
Agent generates decision
    ↓
Decision persisted to MongoDB
    ↓
User acknowledges/executes actions
    ↓
Outcomes recorded (wasSuccessful, measuredImpact)
    ↓
Next agent session retrieves outcomes via ContextAssembler
    ↓
Agent reasons with knowledge of what worked before
    ↓
Better decisions
```

This is what makes OpsMind improve over time — not fine-tuning, but persistent operational memory.
