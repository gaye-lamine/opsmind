# OpsMind — System Architecture

## Overview

OpsMind is an autonomous operational intelligence agent system built for the Google Cloud Rapid Agent Hackathon. It is not a chatbot. It is a multi-step reasoning engine that analyzes business problems, retrieves organizational memory from MongoDB, generates structured decisions using Google Gemini, and continuously improves through persistent memory.

---

## Monorepo Structure

```
opsmind/
├── apps/
│   ├── api/          → Express API server (orchestration entry point)
│   └── web/          → Next.js operational intelligence dashboard
├── packages/
│   ├── agent/        → Autonomous runtime layer
│   ├── ai/           → Intelligence layer (Gemini, prompts, reasoning)
│   ├── memory/       → Operational memory layer (MongoDB)
│   ├── tools/        → MCP tool capability layer
│   ├── shared/       → Shared types, DTOs, validators, utils
│   └── config/       → Environment, database, agent, cloud config
└── docs/             → Architecture, workflows, API contracts
```

---

## Dependency Graph

Dependencies flow **downward only**. No circular dependencies.

```
apps/web
    ↓ (HTTP only — typed API client)
apps/api
    ↓ (imports)
packages/agent
    ↓ (imports)
packages/ai  +  packages/tools  +  packages/memory
    ↓ (imports)
packages/shared  +  packages/config
```

---

## Layer Responsibilities

### `apps/web` — Presentation Layer
- Next.js 15 App Router, TypeScript, Tailwind CSS
- Server Components for data fetching (no client-side DB access)
- Communicates with `apps/api` exclusively via typed HTTP client
- Renders: dashboard, decisions, actions, memory visualization, investigation launcher
- **Never** contains business logic, AI reasoning, or database access

### `apps/api` — API Layer
- Express.js server with typed routes, controllers, middleware
- Validates all inputs with Zod DTOs
- Delegates all business logic to `@opsmind/agent`
- Returns standard `{ success, data?, error? }` envelope on all routes
- **Never** contains reasoning logic, prompt logic, or direct MongoDB queries

### `packages/agent` — Autonomous Runtime Layer
- `AgentRuntime` — singleton bootstrap and session management
- `Orchestrator` — coordinates the full 8-step reasoning pipeline
- `ExecutionLoop` — iterates over the execution plan, invokes tools via registry
- `AgentStateManager` — maintains in-memory state during execution
- Specialized workflows: business-analysis, anomaly-investigation, strategic-planning, action-execution

### `packages/ai` — Intelligence Layer
- `GeminiClient` — structured JSON output, automatic retries, Zod validation
- Reasoning engines: `GoalDecomposer`, `PlannerEngine`, `DecisionSynthesizer`, `ReflectionLoop`
- Versioned, modular prompts: system, planner, decision, evaluator
- Zod schemas for all AI outputs — unvalidated output is forbidden

### `packages/memory` — Operational Memory Layer
- MongoDB collections: `decisions`, `sessions`, `operational_state`, `actions`, `execution_logs`
- Typed repositories with repository pattern — no raw MongoDB access outside this layer
- `ContextAssembler` — builds memory context for each reasoning session
- `MemoryWriter` — persists decisions, actions, logs, session state
- `VectorStore` — semantic similarity search (MongoDB Atlas Vector Search)

### `packages/tools` — Action Capability Layer
- `ToolRegistry` — singleton registry for tool discovery and execution
- MCP tools: `read_operational_state`, `write_decision`, `update_memory`, `action_log`
- Analytics tools: `analyze_metrics` (z-score anomaly detection)
- Business tools: `retrieve_decisions` (historical pattern retrieval)
- AI **never** accesses MongoDB directly — always through tools

### `packages/shared` — Shared Contracts
- TypeScript interfaces: `Decision`, `AgentSession`, `OperationalState`, `ToolCall`
- Zod DTOs for all API boundaries
- Error hierarchy: `OpsMindError`, `AgentError`, `MemoryError`, `AIError`, `ToolError`
- Utilities: `Logger`, `successResponse`, `errorResponse`, ID generators

### `packages/config` — Configuration Layer
- Zod-validated environment loading — system refuses to boot with invalid config
- `getDatabaseConfig()`, `getAgentConfig()`, `getCloudConfig()`
- Single source of truth for collection names, pipeline step identifiers

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | Node.js, Express 4, TypeScript |
| AI Reasoning | Google Gemini 1.5 Pro |
| AI Platform | Google Cloud Agent Builder |
| Operational Memory | MongoDB (Atlas) |
| Vector Search | MongoDB Atlas Vector Search |
| Build System | Turborepo, tsup |
| Package Manager | pnpm workspaces |

---

## Bootstrap Sequence

When `apps/api` starts:

```
1. loadEnv()           → validate all environment variables (Zod)
2. connectDatabase()   → establish MongoDB connection pool
3. ensureIndexes()     → create all MongoDB indexes (idempotent)
4. initializeTools()   → register all MCP tools in the registry
5. createApp()         → configure Express middleware and routes
6. app.listen()        → accept HTTP requests
```

If any step fails, the process exits. No partial startup.

---

## Data Flow — Agent Session

```
HTTP POST /api/agent/sessions
    ↓
AgentController.startSession()
    ↓
AgentService.startSession()          → selects workflow based on goal
    ↓
AgentRuntime.runSession()
    ↓
Orchestrator.run()
    ↓
[Full reasoning pipeline — see REASONING_PIPELINE.md]
    ↓
AgentRunResult { success, decision, durationMs }
    ↓
HTTP 201 { success: true, data: { sessionId, decisionId, summary, ... } }
```
