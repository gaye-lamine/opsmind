/**
 * @opsmind/ai
 *
 * Intelligence layer for OpsMind.
 *
 * This package owns all AI reasoning capabilities:
 * - Gemini client (structured output, retries, validation)
 * - Zod schemas for all AI outputs
 * - Versioned, modular prompts
 * - Reasoning engines (goal decomposition, planning, decision synthesis, reflection)
 *
 * Architecture rules:
 * - ALL Gemini outputs are validated against Zod schemas before use (§6.4)
 * - Prompts are modular and versioned — never hardcoded inline (§6.1)
 * - Reflection is mandatory — every decision goes through the reflection loop (§2.4)
 * - This package imports from @opsmind/config and @opsmind/shared only
 * - Never imports from @opsmind/memory, @opsmind/tools, or @opsmind/agent
 *
 * Usage:
 *   import { GoalDecomposer, PlannerEngine, DecisionSynthesizer, ReflectionLoop } from '@opsmind/ai'
 */

// ─── Gemini Client ────────────────────────────────────────────────────────────
export {
  GeminiClient,
  getGeminiClient,
  generateEmbedding,
  type GenerationRequest,
  type GenerationResult,
} from "../gemini/client";

// ─── LLM Abstraction ─────────────────────────────────────────────────────────
export {
  GeminiLLM,
  getDefaultLlm,
  type ILlm,
} from "../core/llm";

// ─── Schemas ──────────────────────────────────────────────────────────────────
export {
  goalDecompositionOutputSchema,
  type GoalDecompositionOutput,
} from "../schemas/goal-decomposition.schema";

export {
  executionPlanOutputSchema,
  type ExecutionPlanOutput,
  type ExecutionPlanStep,
} from "../schemas/execution-plan.schema";

export {
  decisionSynthesisOutputSchema,
  type DecisionSynthesisOutput,
} from "../schemas/decision-synthesis.schema";

export {
  reflectionOutputSchema,
  type ReflectionOutput,
} from "../schemas/reflection.schema";

// ─── Prompts ──────────────────────────────────────────────────────────────────
export {
  OPSMIND_SYSTEM_PROMPT,
  OPSMIND_SYSTEM_PROMPT_VERSION,
} from "../prompts/system/opsmind.system.prompt";

export {
  PLANNER_SYSTEM_PROMPT,
  buildPlannerUserPrompt,
  type PlannerUserPromptParams,
} from "../prompts/planner/planner.prompt";

export {
  DECISION_SYSTEM_PROMPT,
  buildDecisionUserPrompt,
  type DecisionUserPromptParams,
  type ToolResultSummary,
} from "../prompts/decision/decision.prompt";

export {
  EVALUATOR_SYSTEM_PROMPT,
  buildEvaluatorUserPrompt,
  type EvaluatorUserPromptParams,
} from "../prompts/evaluator/evaluator.prompt";

// ─── Reasoning Engines ────────────────────────────────────────────────────────
export { GoalDecomposer } from "../reasoning/goal-decomposition/goal-decomposer";

export {
  PlannerEngine,
  type AvailableTool,
} from "../reasoning/planner-engine/planner";

export {
  DecisionSynthesizer,
  type SynthesisInput,
} from "../reasoning/decision-engine/decision-synthesizer";

export {
  ReflectionLoop,
  type ReflectionResult,
} from "../reasoning/reflection-loop/reflector";
