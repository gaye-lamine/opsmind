# OpsMind — API Contracts

## Base URL

```
http://localhost:3001/api
```

## Response Envelope

All responses use the standard envelope:

```typescript
{
  success: boolean,
  data?: T,
  error?: {
    code: string,
    message: string,
    details?: Record<string, unknown>
  },
  meta?: {
    requestId: string,
    timestamp: string,
    durationMs?: number,
    pagination?: {
      page: number,
      pageSize: number,
      total: number,
      totalPages: number
    }
  }
}
```

---

## Health

### `GET /api/health`

Liveness check.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "opsmind-api",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### `GET /api/health/ready`

Readiness check — verifies MongoDB and tool registry.

**Response 200 (healthy):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "mongodb": true,
    "toolRegistry": true,
    "details": { "bootstrapped": true, "toolCount": 6 }
  }
}
```

**Response 503 (unhealthy):**
```json
{
  "success": true,
  "data": { "status": "unhealthy", "mongodb": false, "toolRegistry": false }
}
```

---

## Agent Sessions

### `POST /api/agent/sessions`

Starts a new agent session and runs the full reasoning pipeline synchronously.

**Request body:**
```typescript
{
  goal: string,           // min 10 chars, max 2000 chars
  context?: {
    domain?: string,      // e.g. "anomaly_investigation", "strategic_planning"
    timeframe?: string,   // e.g. "this week", "Q4 2024"
    metrics?: string[]    // e.g. ["CAC", "LTV", "churn_rate"]
  }
}
```

**Response 201 (success):**
```json
{
  "success": true,
  "data": {
    "sessionId": "session_<uuid>",
    "decisionId": "decision_<uuid>",
    "status": "completed",
    "summary": "Customer acquisition costs increased due to...",
    "confidenceScore": 0.82,
    "confidenceLevel": "high",
    "findingsCount": 3,
    "recommendationsCount": 4,
    "durationMs": 45230
  }
}
```

**Response 500 (agent failure):**
```json
{
  "success": false,
  "error": {
    "code": "AGENT_REASONING_FAILED",
    "message": "Execution loop aborted: critical step failed"
  }
}
```

**Notes:**
- This is a synchronous call — it blocks until the full pipeline completes (~30–120s)
- For production, wrap in a background job queue
- The `domain` context hint routes to specialized workflows (anomaly_investigation → `runAnomalyInvestigation`, strategic_planning → `runStrategicPlanning`)

---

### `GET /api/agent/sessions/active`

Returns currently running sessions.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "sessionId": "session_<uuid>",
        "status": "running",
        "currentStep": "execution",
        "stepCount": 3,
        "progress": 37,
        "startedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "total": 1
  }
}
```

---

### `GET /api/agent/sessions`

Returns recent completed sessions.

**Query params:** `pageSize` (default 20)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "sessions": [ /* SessionStatusOutput[] */ ],
    "total": 12
  }
}
```

---

### `GET /api/agent/sessions/:sessionId`

Returns the status of a specific session.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session_<uuid>",
    "status": "completed",
    "currentStep": "completed",
    "stepCount": 7,
    "progress": 100,
    "startedAt": "2024-01-15T10:30:00.000Z",
    "completedAt": "2024-01-15T10:31:15.000Z",
    "durationMs": 75000,
    "decisionId": "decision_<uuid>"
  }
}
```

**Response 404:**
```json
{
  "success": false,
  "error": { "code": "AGENT_SESSION_NOT_FOUND", "message": "Session <id> not found" }
}
```

---

## Decisions

### `GET /api/decisions`

Returns a paginated list of decisions.

**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Results per page (max 100) |
| `category` | string | — | Filter by category |
| `status` | string | — | Filter by status |
| `sessionId` | string | — | Filter by session |
| `from` | ISO date | — | Created after |
| `to` | ISO date | — | Created before |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "decisions": [
      {
        "id": "decision_<uuid>",
        "sessionId": "session_<uuid>",
        "goal": "Customer acquisition costs increased by 37%...",
        "category": "anomaly_resolution",
        "status": "finalized",
        "confidenceLevel": "high",
        "confidenceScore": 0.82,
        "summary": "CAC increase driven by...",
        "recommendationCount": 4,
        "createdAt": "2024-01-15T10:31:15.000Z"
      }
    ],
    "pagination": { "page": 1, "pageSize": 20, "total": 47, "totalPages": 3 }
  }
}
```

---

### `GET /api/decisions/:id`

Returns full decision detail including findings, recommendations, reflection, and reasoning trace.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "decision": {
      "id": "decision_<uuid>",
      "sessionId": "session_<uuid>",
      "goal": "...",
      "category": "anomaly_resolution",
      "status": "finalized",
      "summary": "...",
      "reasoning": "Full reasoning narrative...",
      "findings": [
        {
          "id": "finding_<uuid>",
          "title": "CAC spike in paid search channel",
          "description": "...",
          "severity": "critical",
          "evidence": ["CPC increased 45%", "Conversion rate dropped 12%"],
          "relatedMetrics": ["CAC", "CPC", "conversion_rate"]
        }
      ],
      "recommendations": [
        {
          "id": "action_<uuid>",
          "title": "Pause underperforming ad groups",
          "description": "...",
          "rationale": "...",
          "priority": "immediate",
          "status": "recommended",
          "estimatedImpact": "Reduce CAC by 15–20% within 7 days",
          "timeframe": "24–48 hours",
          "risks": ["Short-term traffic reduction"]
        }
      ],
      "reflection": {
        "confidenceAssessment": "Confidence is well-calibrated...",
        "reasoningQuality": "Strong causal chain...",
        "identifiedRisks": ["Seasonal effects not fully accounted for"],
        "alternativeApproaches": ["Consider organic channel optimization"],
        "limitations": ["Limited to 5 historical snapshots"],
        "improvementSuggestions": ["Include competitor data"],
        "overallScore": 0.84
      },
      "confidenceScore": 0.82,
      "confidenceLevel": "high",
      "reasoningTrace": {
        "steps": [ /* ReasoningTraceStep[] */ ],
        "totalDurationMs": 75000,
        "modelUsed": "gemini-2.5-pro",
        "promptTokens": 4200,
        "completionTokens": 1800
      },
      "toolsUsed": ["read_operational_state", "analyze_metrics", "retrieve_decisions"],
      "memoryReferences": ["decision_<uuid1>", "decision_<uuid2>"],
      "createdAt": "2024-01-15T10:31:15.000Z",
      "updatedAt": "2024-01-15T10:31:15.000Z"
    }
  }
}
```

**Response 404:**
```json
{
  "success": false,
  "error": { "code": "DECISION_NOT_FOUND", "message": "Decision <id> not found" }
}
```

---

## Actions

### `GET /api/actions/pending`

Returns all pending action recommendations across all decisions.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "actions": [ /* ActionRecommendation[] */ ],
    "total": 8
  }
}
```

---

### `GET /api/actions/decision/:decisionId`

Returns all actions for a specific decision.

---

### `PATCH /api/actions/:id/status`

Updates the status of an action recommendation.

**Request body:**
```typescript
{
  status: "acknowledged" | "in_progress" | "completed" | "dismissed",
  notes?: string   // max 1000 chars
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "actionId": "action_<uuid>",
    "status": "in_progress",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

---

### `POST /api/actions/:id/outcome`

Records the outcome of a completed action. **This closes the feedback loop** — future agent sessions will learn from this outcome.

**Request body:**
```typescript
{
  wasSuccessful: boolean,
  notes: string,
  measuredImpact?: string   // e.g. "CAC reduced by 18% over 7 days"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "actionId": "action_<uuid>",
    "outcomeRecorded": true,
    "recordedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

---

## Dashboard

### `GET /api/dashboard`

Returns the complete operational intelligence dashboard state.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "operationalState": {
      "id": "state_<uuid>",
      "snapshotAt": "2024-01-15T10:00:00.000Z",
      "metrics": [ /* BusinessMetric[] */ ],
      "anomalies": [ /* DetectedAnomaly[] */ ],
      "activeInvestigations": ["session_<uuid>"],
      "lastDecisionId": "decision_<uuid>",
      "summary": "Business metrics show elevated CAC..."
    },
    "recentDecisions": [ /* DecisionSummary[] */ ],
    "activeAnomalies": [ /* DetectedAnomaly[] */ ],
    "pendingActions": [ /* ActionRecommendation[] */ ],
    "systemHealth": {
      "status": "healthy",
      "agentStatus": "ready",
      "memoryStatus": "connected",
      "lastActivityAt": "2024-01-15T10:31:15.000Z"
    }
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body/query failed Zod validation |
| `INVALID_INPUT` | 400 | Semantically invalid input |
| `AGENT_SESSION_NOT_FOUND` | 404 | Session ID does not exist |
| `DECISION_NOT_FOUND` | 404 | Decision ID does not exist |
| `TOOL_NOT_FOUND` | 404 | Tool name not in registry |
| `AGENT_TIMEOUT` | 408 | Session exceeded total timeout |
| `AI_RATE_LIMITED` | 429 | Gemini API rate limit hit |
| `AGENT_REASONING_FAILED` | 500 | Pipeline aborted due to critical step failure |
| `AI_GENERATION_FAILED` | 500 | Gemini failed after all retries |
| `AI_SCHEMA_VALIDATION_FAILED` | 500 | Gemini output failed Zod validation |
| `MEMORY_READ_FAILED` | 500 | MongoDB read error |
| `MEMORY_WRITE_FAILED` | 500 | MongoDB write error |
| `DATABASE_ERROR` | 503 | MongoDB connection error |
| `SERVICE_UNAVAILABLE` | 503 | System not ready |
