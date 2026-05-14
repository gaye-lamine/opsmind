# OpsMind

## AI Operational Intelligence System

OpsMind is an autonomous operational intelligence agent built for the **Google Cloud Rapid Agent Hackathon**.

It is not a chatbot. It is a multi-step reasoning engine that investigates business problems, retrieves organizational memory from MongoDB, generates structured decisions using Google Gemini, and continuously improves through persistent memory.

---

## What OpsMind Does

OpsMind helps founders and operators answer questions like:

- Why did customer acquisition costs increase 37% this week?
- What operational risks should we monitor this quarter?
- Which business metrics are behaving abnormally?
- What actions should we take next?
- What happened after similar situations in the past?

The system reasons through the problem **autonomously** — it does not wait for follow-up prompts.

---

## Technology Stack

| Component | Technology |
|---|---|
| AI Reasoning | **Google Gemini 2.5 Pro** |
| AI Platform | **Google Cloud Agent Builder** |
| Operational Memory | **MongoDB Atlas** |
| Vector Search | MongoDB Atlas Vector Search |
| Backend | Node.js, Express, TypeScript |
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Build | Turborepo, pnpm workspaces |

---

## Reasoning Pipeline

Every investigation executes a deterministic 8-step pipeline:

```
1. Context Assembly      → reads current state + history from MongoDB
2. Goal Decomposition    → Gemini classifies goal, generates reasoning steps
3. Planning              → Gemini maps steps to specific tool calls
4. Tool Selection        → resolves tools from MCP registry
5. Execution             → invokes tools, records results
6. Decision Synthesis    → Gemini synthesizes findings + recommendations
7. Reflection            → Gemini evaluates decision quality (MANDATORY)
8. Memory Persistence    → stores decision + actions to MongoDB
```

No steps are skipped. Reflection is mandatory.

---

## Architecture

```
apps/web          → Next.js operational intelligence dashboard
apps/api          → Express API server
packages/agent    → Autonomous runtime (orchestrator, execution loop, workflows)
packages/ai       → Intelligence layer (Gemini, prompts, reasoning engines)
packages/memory   → Operational memory (MongoDB collections, repositories)
packages/tools    → MCP tool capability layer (tool registry)
packages/shared   → Shared types, DTOs, validators
packages/config   → Environment and configuration
```

Dependencies flow downward only. No circular dependencies.

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
# Edit .env — set MONGODB_URI and GEMINI_API_KEY

# Seed MongoDB with initial operational state
pnpm seed

# Start API server (port 3001)
pnpm api

# Start web dashboard (port 3000)
pnpm web
```

Open [http://localhost:3000](http://localhost:3000)

---

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/architecture/ARCHITECTURE.md) | System architecture and layer responsibilities |
| [Reasoning Pipeline](docs/agent-flow/REASONING_PIPELINE.md) | 8-step pipeline with step-by-step details |
| [Memory Model](docs/architecture/MEMORY_MODEL.md) | MongoDB collections and memory retrieval strategy |
| [Tool Registry](docs/architecture/TOOL_REGISTRY.md) | MCP tools and how to add new ones |
| [Workflows](docs/agent-flow/WORKFLOWS.md) | Specialized workflows with examples |
| [API Contracts](docs/api/API_CONTRACTS.md) | Full API documentation with request/response shapes |
| [Decision Intelligence](docs/decisions/DECISION_INTELLIGENCE.md) | Decision structure, confidence scoring, reflection |
| [Demo Guide](docs/demo/DEMO_GUIDE.md) | Demo scenarios and setup instructions |
| [Deployment](docs/architecture/DEPLOYMENT.md) | Local dev, Atlas setup, production considerations |

---

## Key Design Decisions

**MongoDB as operational memory, not a database.** Every reasoning step is persisted. Future sessions retrieve historical decisions, action outcomes, and operational state to make better decisions. The system improves over time without fine-tuning.

**Structured AI output only.** All Gemini outputs are validated against Zod schemas before use. Unvalidated AI output is forbidden. The system retries up to 3 times on malformed output.

**Reflection is mandatory.** Every decision is evaluated by an independent critic (also Gemini) before finalization. The critic adjusts the confidence score and identifies risks, alternatives, and limitations.

**Tool registry pattern.** The AI never accesses MongoDB directly. All external capabilities are exposed through MCP tools with typed interfaces. The planner selects tools by name from the registry manifest.

**Clean architecture.** Eight packages with strict dependency ordering. No circular dependencies. Each layer has a single responsibility.

---

## Hackathon Track

Built for the **Google Cloud Rapid Agent Hackathon** with focus on:
- Agentic AI systems with Google Gemini
- Google Cloud Agent Builder integration
- MongoDB MCP integration as operational memory
- Multi-step reasoning workflows
- Persistent AI memory systems
