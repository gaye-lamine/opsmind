# ENGINEERING_RULES.md

# OpsMind Engineering Rules

This document defines the mandatory engineering principles, architectural constraints, implementation standards, and AI coding behavior for the OpsMind project.

Every AI coding assistant, contributor, or engineer MUST follow these rules strictly.

---

# 1. PROJECT VISION

OpsMind is NOT a chatbot.

OpsMind is an autonomous operational intelligence agent system designed for business decision-making.

The system:
- analyzes operational/business signals
- reasons using Gemini
- retrieves historical memory from MongoDB
- generates structured decisions
- recommends actions
- persists reasoning traces
- continuously improves through memory

The product must feel:
- enterprise-grade
- intelligent
- autonomous
- analytical
- operational
- trustworthy

NEVER build generic AI chat UX patterns.

---

# 2. CORE PRODUCT PRINCIPLES

## 2.1 Decision Intelligence > Conversation

The product exists to:
- generate decisions
- investigate anomalies
- monitor operations
- suggest actions
- track outcomes
- reason over historical context

NOT to casually chat.

---

## 2.2 Memory Is The Core

MongoDB is NOT a simple database.

MongoDB is:
- operational memory
- historical intelligence
- decision history
- state persistence
- context engine

Every important reasoning step MUST be persisted.

---

## 2.3 Structured AI Only

All AI outputs MUST be:
- deterministic
- typed
- validated
- schema-driven

NEVER rely on raw LLM text output.

Always use:
- Zod schemas
- typed DTOs
- structured JSON outputs

---

## 2.4 Reflection Is Mandatory

Every important decision MUST go through:
- evaluation
- confidence analysis
- risk assessment
- alternative consideration

Reflection is NOT optional.

---

# 3. ARCHITECTURE RULES

---

# 3.1 Monorepo Structure

The architecture MUST remain:

apps/
packages/
docs/

DO NOT flatten architecture.

DO NOT mix frontend/backend concerns.

DO NOT place business logic inside apps/web.

---

# 3.2 Layer Responsibilities

## apps/web

ONLY:
- UI
- visualization
- dashboards
- user interaction
- API consumption

NEVER:
- business logic
- orchestration
- AI reasoning
- database access

---

## apps/api

ONLY:
- API routes
- controllers
- middleware
- request orchestration
- authentication
- validation

NEVER:
- core reasoning logic
- prompt logic
- direct Mongo queries

---

## packages/ai

Contains:
- Gemini integration
- prompts
- schemas
- reasoning engines
- planners
- evaluators
- reflection systems

This is the intelligence layer.

---

## packages/agent

Contains:
- orchestration
- execution loops
- workflow engines
- runtime coordination
- state management

This is the autonomous runtime layer.

---

## packages/memory

Contains:
- repositories
- collections
- vector memory
- retrieval
- historical context assembly

This is the operational memory layer.

---

## packages/tools

Contains:
- MCP tools
- action interfaces
- tool registry
- integrations

This is the action capability layer.

---

## packages/shared

Contains:
- DTOs
- types
- validators
- constants
- utilities

NO business logic here.

---

## packages/config

Contains:
- env loading
- validation
- cloud config
- database config
- runtime config

---

# 4. CLEAN ARCHITECTURE RULES

Dependencies MUST flow downward only.

Allowed direction:

web
 ↓
api
 ↓
agent
 ↓
ai + tools + memory
 ↓
shared/config

NEVER create circular dependencies.

NEVER import upward.

---

# 5. TYPESCRIPT RULES

MANDATORY:
- strict mode
- explicit typing
- no any
- no implicit any
- typed responses everywhere

Forbidden:
- any
- unknown casting abuse
- massive untyped objects

Prefer:
- interfaces
- discriminated unions
- typed DTOs
- schema validation

---

# 6. AI ENGINEERING RULES

---

# 6.1 Prompt System

Prompts MUST be:
- modular
- versioned
- isolated by responsibility

Structure:
- system prompts
- planner prompts
- evaluator prompts
- decision prompts

NEVER hardcode giant prompts inline.

---

# 6.2 Reasoning Pipeline

Every reasoning flow MUST follow:

Context Assembly
→ Goal Decomposition
→ Planning
→ Tool Selection
→ Execution
→ Reflection
→ Decision Synthesis
→ Memory Persistence

Do NOT skip steps.

---

# 6.3 Tool Usage

AI NEVER directly accesses databases.

AI MUST interact through tools.

All external capabilities MUST be exposed through:
- MCP tools
- registries
- typed interfaces

---

# 6.4 AI Output Validation

ALL Gemini outputs MUST be validated before use.

Required:
- Zod validation
- retries on malformed output
- safe parsing
- fallback handling

Unvalidated AI output is forbidden.

---

# 7. MONGODB RULES

MongoDB is the central system of the hackathon track.

Use MongoDB for:
- decisions
- sessions
- state
- logs
- memory
- historical reasoning
- action tracking

NOT just CRUD.

Collections must remain highly structured.

---

# 8. FRONTEND RULES

UI direction:
- modern operational dashboard
- enterprise intelligence platform
- minimal but dense
- analytical
- clean visual hierarchy

Avoid:
- toy AI UIs
- generic chat bubbles
- playful design
- excessive gradients
- gimmicks

Preferred:
- tables
- timelines
- operational cards
- investigations
- monitoring panels
- decision streams
- memory visualization

---

# 9. API RULES

All routes MUST:
- validate input
- validate output
- return typed responses
- handle failures gracefully

Standard API response shape:

{
  success: boolean,
  data?: T,
  error?: {
    code: string,
    message: string
  }
}

---

# 10. ERROR HANDLING RULES

NEVER swallow errors.

All failures MUST:
- be logged
- contain context
- include traceability
- preserve debugging information

Use:
- domain errors
- typed errors
- centralized logging

---

# 11. PERFORMANCE RULES

Optimize for:
- reasoning quality
- memory retrieval speed
- deterministic orchestration
- scalable execution loops

Avoid:
- unnecessary re-renders
- duplicate memory retrievals
- giant prompts
- excessive context windows

---

# 12. SECURITY RULES

Secrets MUST:
- use environment variables
- never be committed
- use Secret Manager in production

Never expose:
- Gemini keys
- Mongo credentials
- internal prompts
- system instructions

---

# 13. DOCUMENTATION RULES

Every major system MUST be documented.

Required docs:
- architecture
- workflows
- reasoning pipeline
- memory model
- API contracts
- tool registry
- deployment

The docs/ folder is part of the judging strategy.

Documentation quality matters.

---

# 14. HACKATHON STRATEGY RULES

The project must demonstrate:

1. Strong Gemini reasoning
2. Strong MongoDB operational memory
3. Real agent orchestration
4. Structured decision intelligence
5. Enterprise-grade architecture
6. Production-quality engineering

The project should feel:
- ambitious
- technically serious
- scalable
- startup-grade
- infrastructure-level

NOT like:
- a weekend chatbot
- a CRUD wrapper around Gemini
- a simple dashboard

---

# 15. AI CODING ASSISTANT BEHAVIOR

When generating code:
- ALWAYS read PRODUCT.md first
- ALWAYS preserve architecture
- NEVER invent new architecture
- NEVER simplify the system
- NEVER collapse layers together
- NEVER create fake implementations
- NEVER generate placeholder business logic pretending to work

Before coding:
1. understand existing structure
2. identify dependencies
3. preserve clean architecture
4. preserve typing
5. preserve modularity

When uncertain:
- ask before changing architecture

---

# 16. FINAL ENGINEERING PRINCIPLE

OpsMind is an autonomous business decision intelligence system powered by:
- Gemini reasoning
- MongoDB memory
- MCP tool orchestration
- operational state analysis

Every engineering decision MUST reinforce this identity.