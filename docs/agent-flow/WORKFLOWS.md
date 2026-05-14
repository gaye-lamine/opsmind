# OpsMind — Agent Workflows

## Overview

OpsMind provides four specialized workflows, each optimized for a specific type of operational problem. All workflows execute the same 8-step reasoning pipeline — they differ in how they frame the goal and configure the agent context.

---

## Workflow Selection

The `AgentService` in `apps/api` automatically selects the appropriate workflow based on the `context.domain` hint or goal text analysis:

```typescript
// Domain hint routing
if (domain === "anomaly_investigation" || isAnomalyGoal(goal)) {
  → runAnomalyInvestigation()
}
if (domain === "strategic_planning") {
  → runStrategicPlanning()
}
// Default
→ runBusinessAnalysis()
```

The `isAnomalyGoal()` heuristic detects keywords: "increased", "decreased", "dropped", "spike", "anomaly", "investigate", "why did", "%", "percent".

---

## Workflow 1 — Business Analysis

**Entry point:** `runBusinessAnalysis()` (`packages/agent/workflows/business-analysis/`)

**Optimized for:**
- Revenue and growth analysis
- Customer acquisition cost investigation
- Churn and retention analysis
- Unit economics review
- Competitive positioning assessment

**Context framing:**
```typescript
{
  domain: "business_operations",
  timeframe: "current_period",
  metrics: []  // populated from request
}
```

**Example goals:**
- "Why did revenue decrease this week?"
- "Analyze our unit economics for Q4"
- "What is driving LTV decline?"

---

## Workflow 2 — Anomaly Investigation

**Entry point:** `runAnomalyInvestigation()` (`packages/agent/workflows/monitoring/`)

**Optimized for:**
- Metric spike/drop investigation
- Operational anomaly root cause analysis
- Performance degradation investigation
- Unexpected behavior analysis

**Goal enrichment:** The workflow automatically enriches the goal with structured framing:
```
"Customer acquisition costs increased by 37% this week. Investigate."
→ "Customer acquisition costs increased by 37% this week. Investigate.
   The affected metric is CAC with a change of +37%.
   This occurred during: this week.
   Investigate the root cause, identify contributing factors, assess business impact,
   and recommend corrective actions."
```

**Context framing:**
```typescript
{
  domain: "anomaly_investigation",
  timeframe: input.timeframe,
  metrics: [input.affectedMetric]
}
```

**Example goals:**
- "CAC increased 37% this week. Investigate."
- "Conversion rate dropped 18% yesterday. What happened?"
- "Revenue spike on Tuesday — understand the cause."

---

## Workflow 3 — Strategic Planning

**Entry point:** `runStrategicPlanning()` (`packages/agent/workflows/planning/`)

**Optimized for:**
- Growth strategy development
- Market opportunity assessment
- Resource allocation decisions
- Operational improvement planning
- Risk mitigation planning

**Horizon options:** `short_term` (30–90 days), `medium_term` (3–6 months), `long_term` (6–18 months)

**Goal enrichment:**
```
"Develop a growth strategy for Q2"
→ "Develop a growth strategy for Q2.
   Focus on the next 3–6 months.
   Constraints to consider: limited marketing budget.
   Key objectives: reach $1M ARR, reduce churn below 5%."
```

**Example goals:**
- "What should our growth strategy be for the next quarter?"
- "How should we allocate our engineering resources?"
- "What operational risks should we prepare for?"

---

## Workflow 4 — Action Execution

**Entry point:** `updateActionStatus()`, `recordActionOutcome()` (`packages/agent/workflows/execution/`)

**Purpose:** Post-decision action lifecycle management. This workflow does **not** invoke Gemini — it directly updates MongoDB via the `action_log` tool.

**Operations:**
- `updateActionStatus(actionId, newStatus, notes)` — track action progress
- `recordActionOutcome(actionId, wasSuccessful, notes, measuredImpact)` — close the feedback loop

**Why this matters:** Recording outcomes is what makes OpsMind improve over time. When the agent retrieves historical decisions in future sessions, it sees which actions led to successful outcomes and weights its recommendations accordingly.

---

## Example: Full Anomaly Investigation

**User input:**
```
POST /api/agent/sessions
{
  "goal": "Customer acquisition costs increased by 37% this week. Investigate.",
  "context": { "metrics": ["CAC", "CPC", "conversion_rate"] }
}
```

**Pipeline execution:**

```
Step 1 — Context Assembly (2.1s)
  → Reads current operational state: CAC = $127 (+37%), CPC = $4.20 (+45%)
  → Retrieves 3 historical decisions about CAC
  → Retrieves 2 pending actions from previous decisions

Step 2 — Goal Decomposition (3.4s)
  → Category: anomaly_investigation
  → Priority: high
  → Steps: context_assembly, data_retrieval, anomaly_analysis, causal_analysis, recommendation_generation
  → Hypotheses: ["Campaign efficiency degraded", "New channel mix", "Seasonal effect"]

Step 3 — Planning (2.8s)
  → Plan: read_operational_state(history) → retrieve_decisions(by_metric, CAC) → analyze_metrics(CAC, CPC) → retrieve_decisions(by_category, anomaly_resolution)

Step 4–5 — Execution (8.2s)
  → read_operational_state: 5 snapshots, CAC trending up for 3 weeks
  → retrieve_decisions: 2 previous CAC investigations found
  → analyze_metrics: CAC z-score = 3.2 (high anomaly), CPC z-score = 4.1 (critical)
  → retrieve_decisions: 1 previous anomaly_resolution with successful outcome

Step 6 — Decision Synthesis (12.3s)
  → Root cause: Paid search CPC spike driven by competitor bidding war
  → 3 findings (1 critical, 2 warning)
  → 4 recommendations (1 immediate, 2 high, 1 medium)
  → Confidence: 0.79

Step 7 — Reflection (8.7s)
  → Assessment: approved_with_notes
  → Adjusted confidence: 0.76 (seasonal effects not fully accounted for)
  → 2 risks identified, 1 alternative approach noted

Step 8 — Memory Persistence (1.2s)
  → Decision persisted: decision_<uuid>
  → 4 action documents created
  → Session finalized: 38.7s total
```

**Response:**
```json
{
  "sessionId": "session_<uuid>",
  "decisionId": "decision_<uuid>",
  "status": "completed",
  "summary": "CAC increase driven by paid search CPC spike...",
  "confidenceScore": 0.76,
  "confidenceLevel": "high",
  "findingsCount": 3,
  "recommendationsCount": 4,
  "durationMs": 38700
}
```
