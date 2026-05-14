# OpsMind — Demo Guide

## Hackathon Demo Strategy

The demo must demonstrate:
1. Real operational problems (not toy examples)
2. Autonomous multi-step reasoning
3. MongoDB as operational memory (not just storage)
4. Structured decision intelligence
5. Reflection loop improving decision quality
6. Memory persistence and retrieval

The demo should feel like an **AI Chief Operating Officer**, not a chatbot.

---

## Setup

### Prerequisites
- MongoDB Atlas cluster (or local MongoDB)
- Google Gemini API key
- Node.js 20+, pnpm

### Environment
```bash
# Edit .env at the monorepo root
# Set MONGODB_URI and GEMINI_API_KEY
```

### Install & Seed
```bash
pnpm install

# Seed MongoDB with initial operational state (run once)
pnpm seed
```

### Start
```bash
# Terminal 1 — API server (port 3001)
pnpm api

# Terminal 2 — Web dashboard (port 3000)
pnpm web
```

Open [http://localhost:3000](http://localhost:3000)

---

## Demo Scenario 1 — Anomaly Investigation

**Narrative:** "A startup founder notices CAC spiked this week. They ask OpsMind to investigate."

**Input:**
```
Customer acquisition costs increased by 37% this week. Investigate root causes and recommend actions.
```

**What to highlight:**
1. The investigation launcher — not a chat box, an investigation form
2. The pipeline progress visualization — 7 steps executing autonomously
3. The decision output — structured findings with evidence, not a paragraph of text
4. The reflection section — the agent critiques its own reasoning
5. The reasoning trace — full transparency into how the decision was made
6. MongoDB — show the decision document in Atlas

---

## Demo Scenario 2 — Memory Retrieval

**Narrative:** "Two weeks later, CAC spikes again. OpsMind remembers the previous investigation."

**Input:**
```
Customer acquisition costs are elevated again. What's different from last time?
```

**What to highlight:**
1. The memory context in the reasoning — "Based on previous investigation from 2 weeks ago..."
2. The `memoryReferences` field in the decision — links to the previous decision
3. The pattern insights from `retrieve_decisions` tool
4. How the confidence score is higher because of historical context

---

## Demo Scenario 3 — Strategic Planning

**Narrative:** "The founder wants to plan for Q2 growth."

**Input:**
```
We need to grow revenue 40% in Q2. What operational changes should we prioritize?
```

**What to highlight:**
1. Different workflow — strategic_planning vs anomaly_investigation
2. Longer-horizon recommendations with timeframes
3. Risk assessment in the reflection
4. Action recommendations with priority levels

---

## Demo Scenario 4 — Action Feedback Loop

**Narrative:** "The founder implemented the CAC recommendations. They record the outcome."

**Steps:**
1. Go to Actions page
2. Mark "Pause underperforming ad groups" as completed
3. Record outcome: wasSuccessful=true, measuredImpact="CAC reduced 18% over 7 days"
4. Run a new investigation
5. Show that the new decision references the successful outcome

**What to highlight:**
1. The feedback loop — outcomes inform future reasoning
2. The `patternInsights` in `retrieve_decisions` output showing action success rate
3. How the agent's recommendations improve based on what worked

---

## Key Technical Points to Emphasize

### Google Gemini Integration
- Structured JSON output mode — not free-form text
- Low temperature (0.2) for deterministic reasoning
- Automatic retries with Zod validation
- 4 specialized prompts: system, planner, decision, evaluator

### MongoDB as Operational Memory
- 5 collections, each with a specific role
- Append-only state snapshots — full history preserved
- Vector search for semantic similarity (when enabled)
- TTL indexes on debug logs
- Feedback loop through action outcomes

### Agent Architecture
- 8-step deterministic pipeline — no steps skipped
- Tool registry pattern — AI never touches MongoDB directly
- Reflection is mandatory — every decision is self-evaluated
- Full reasoning trace persisted for transparency

### Production-Grade Engineering
- Zod validation at every boundary
- Typed error hierarchy
- Structured logging with session context
- Graceful shutdown with MongoDB disconnect
- Monorepo with clean dependency graph

---

## What NOT to Demo

- Do not show the raw MongoDB queries
- Do not show the Gemini API calls directly
- Do not frame it as a chatbot
- Do not demo generic Q&A
- Do not show placeholder/fake data

The demo should feel like a real operational intelligence platform used by a real startup.
