# OpsMind — Reasoning Pipeline

## Overview

Every agent session executes a deterministic 8-step reasoning pipeline. No steps are skipped. The pipeline is implemented in `packages/agent/core/orchestrator/orchestrator.ts`.

---

## Pipeline Diagram

```
User Goal Input
       │
       ▼
┌─────────────────────────────┐
│  1. Context Assembly        │  ← MongoDB: reads current state + historical decisions
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  2. Goal Decomposition      │  ← Gemini: classifies goal, generates reasoning steps
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  3. Planning                │  ← Gemini: maps steps to specific tool calls
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  4. Tool Selection          │  ← Tool Registry: resolves tools by name
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  5. Execution               │  ← ExecutionLoop: invokes tools, records results
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  6. Decision Synthesis      │  ← Gemini: synthesizes findings + recommendations
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  7. Reflection (MANDATORY)  │  ← Gemini: evaluates decision quality, adjusts confidence
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  8. Memory Persistence      │  ← MongoDB: stores decision, actions, logs, finalizes session
└─────────────────────────────┘
       │
       ▼
  Decision Output
```

---

## Step Details

### Step 1 — Context Assembly

**Component:** `ContextAssembler` (`packages/memory/memory-engine/context-assembler.ts`)

**What it does:**
- Reads current operational state from MongoDB (`operational_state` collection)
- Retrieves recent finalized decisions (configurable limit, default 5)
- Retrieves category-specific historical decisions
- Retrieves pending actions and successful action patterns
- Assembles a `MemoryContext` object injected into all subsequent Gemini calls

**Why it matters:** Every reasoning session starts with full organizational memory. The agent knows what happened before, what worked, and what the current business state is.

**MongoDB reads:**
- `operational_state` → current snapshot
- `decisions` → recent + category-specific finalized decisions
- `actions` → pending actions + completed actions with outcomes

---

### Step 2 — Goal Decomposition

**Component:** `GoalDecomposer` (`packages/ai/reasoning/goal-decomposition/goal-decomposer.ts`)

**What it does:**
- Sends the raw goal + operational context + memory context to Gemini
- Gemini classifies the goal into a category (anomaly_investigation, business_analysis, etc.)
- Generates 3–6 ordered reasoning steps with required tools
- Produces initial hypotheses and focus areas
- Assesses complexity and priority

**Output schema:** `goalDecompositionOutputSchema` (Zod-validated)

**Example output for "CAC increased 37% this week":**
```json
{
  "category": "anomaly_investigation",
  "refinedGoal": "Investigate 37% increase in customer acquisition costs...",
  "reasoningSteps": [
    { "stepNumber": 1, "stepType": "context_assembly", "requiredTools": ["read_operational_state"] },
    { "stepNumber": 2, "stepType": "data_retrieval", "requiredTools": ["retrieve_decisions"] },
    { "stepNumber": 3, "stepType": "anomaly_analysis", "requiredTools": ["analyze_metrics"] },
    { "stepNumber": 4, "stepType": "causal_analysis", "requiredTools": ["retrieve_decisions"] }
  ],
  "initialHypotheses": ["Campaign efficiency degraded", "New channel mix shift", "Seasonal effect"],
  "complexity": "medium",
  "priority": "high"
}
```

---

### Step 3 — Planning

**Component:** `PlannerEngine` (`packages/ai/reasoning/planner-engine/planner.ts`)

**What it does:**
- Takes the decomposed goal + available tools (from registry manifests)
- Sends to Gemini with the planner prompt
- Gemini produces a concrete execution plan: ordered steps with exact tool names and input parameters
- Validates that all tool names exist in the registry (filters invalid tools)

**Output schema:** `executionPlanOutputSchema` (Zod-validated)

**Key constraint:** Tool names in the plan must exactly match registered tool names. Invalid tools are filtered out. If no valid steps remain, the pipeline aborts.

---

### Step 4 & 5 — Tool Selection + Execution

**Component:** `ExecutionLoop` (`packages/agent/core/execution-loop/execution-loop.ts`)

**What it does:**
- Iterates over each step in the execution plan
- Resolves each tool from `ToolRegistry` by name
- Invokes `registry.execute(toolName, toolInput)` — enforces MCP tool interface
- Records each tool call in `AgentStateManager` (started → completed/failed)
- Handles critical vs non-critical step failures:
  - Critical step fails → abort pipeline
  - Non-critical step fails → log warning, continue

**Tool execution flow:**
```
registry.execute(toolName, input)
    ↓
BaseTool.execute(input)          → validates input with Zod
    ↓
BaseTool.run(validatedInput)     → actual tool logic
    ↓
validates output with Zod
    ↓
ToolResult<T> { success, data, durationMs }
```

**Enforced limit:** `AGENT_MAX_STEPS` (default 10) — prevents runaway execution.

---

### Step 6 — Decision Synthesis

**Component:** `DecisionSynthesizer` (`packages/ai/reasoning/decision-engine/decision-synthesizer.ts`)

**What it does:**
- Assembles all tool execution results into a structured prompt
- Sends to Gemini with the decision synthesis prompt
- Gemini produces: summary, full reasoning, findings (with evidence), recommendations (with priority/impact/timeframe), confidence score, root cause analysis
- Maps output to the `Decision` domain type with generated IDs

**Output schema:** `decisionSynthesisOutputSchema` (Zod-validated)

**Confidence scoring guide (from prompt):**
- 0.9–1.0: Multiple corroborating sources, clear causal chain
- 0.7–0.9: Strong evidence, minor gaps
- 0.5–0.7: Moderate evidence, some assumptions
- 0.3–0.5: Limited data, significant uncertainty
- 0.0–0.3: Insufficient data, highly speculative

---

### Step 7 — Reflection (MANDATORY)

**Component:** `ReflectionLoop` (`packages/ai/reasoning/reflection-loop/reflector.ts`)

**What it does:**
- Acts as an independent critic of the synthesized decision
- Evaluates: evidence quality, reasoning coherence, recommendation quality, confidence calibration, completeness
- Produces an assessment: `approved`, `approved_with_notes`, or `needs_revision`
- Adjusts the confidence score (up or down)
- Identifies risks, alternative approaches, limitations

**Output schema:** `reflectionOutputSchema` (Zod-validated)

**Why it's mandatory:** Reflection catches overconfident or poorly-reasoned decisions before they are persisted as organizational memory. A bad decision in memory degrades future reasoning.

**Effect on decision:**
- `reflection` object attached to the `Decision`
- `confidenceScore` adjusted to `adjustedConfidenceScore`
- `status` updated to `"reflected"`

---

### Step 8 — Memory Persistence

**Component:** `MemoryWriter` (`packages/memory/memory-engine/memory-writer.ts`)

**What it does:**
- Persists the full `Decision` document to MongoDB `decisions` collection
- Persists each `ActionRecommendation` as a separate trackable `Action` document
- Writes execution logs for the session
- Marks the session as `completed` with `decisionId` and `durationMs`
- Updates operational state with the new `lastDecisionId`
- Removes the session from `activeInvestigations`

**Why separate action documents:** Actions need independent lifecycle tracking. A user can acknowledge, start, complete, or dismiss each action individually. Outcomes are recorded to close the feedback loop for future reasoning.

---

## Timeout and Error Handling

- **Total timeout:** `AGENT_TOTAL_TIMEOUT_MS` (default 120s) — session is marked `timeout` if exceeded
- **Step timeout:** `AGENT_STEP_TIMEOUT_MS` (default 30s) per tool call
- **Max steps:** `AGENT_MAX_STEPS` (default 10) — prevents runaway loops
- **Critical step failure:** aborts pipeline, records failure in session
- **Non-critical step failure:** logs warning, continues with remaining steps
- **Gemini retry:** up to 3 attempts with exponential backoff on malformed output

---

## Configuration

All pipeline parameters are configurable via environment variables:

| Variable | Default | Description |
|---|---|---|
| `AGENT_MAX_STEPS` | 10 | Maximum tool execution steps |
| `AGENT_REFLECTION_ENABLED` | true | Whether to run reflection step |
| `AGENT_CONFIDENCE_THRESHOLD` | 0.7 | Minimum confidence for high-quality decision |
| `AGENT_MEMORY_RETRIEVAL_LIMIT` | 5 | Historical decisions to retrieve per session |
| `GEMINI_TEMPERATURE` | 0.2 | Low temperature for deterministic reasoning |
