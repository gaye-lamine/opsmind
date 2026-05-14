import { type ZodSchema } from "zod";
import { type GenerationRequest, type GenerationResult } from "../gemini/client";

/**
 * LLM Abstraction — the interface that decouples the reasoning engines
 * from any specific LLM provider.
 *
 * Today: GeminiLLM (Google AI Studio or Vertex AI)
 * Future: OpenAILLM, ClaudeLLM, etc.
 *
 * The reasoning engines (GoalDecomposer, PlannerEngine, DecisionSynthesizer,
 * ReflectionLoop) depend only on this interface — never on a concrete SDK.
 *
 * Design note: the reasoning engines currently use getGeminiClient() directly
 * for backward compatibility. This interface is the target abstraction for
 * future refactoring. New code should depend on ILlm, not GeminiClient.
 */
export interface ILlm {
  /**
   * Generates a structured output validated against the provided Zod schema.
   *
   * This is the primary method — all LLM interactions in OpsMind produce
   * typed, validated JSON. Raw text output is forbidden (§2.3, §6.4).
   */
  generateStructured<T>(
    request: GenerationRequest,
    schema: ZodSchema<T>
  ): Promise<GenerationResult<T>>;
}

/**
 * GeminiLLM — ILlm implementation backed by the GeminiClient.
 *
 * Wraps the existing GeminiClient singleton to implement ILlm.
 * This allows code that depends on ILlm to use Gemini without
 * importing the GeminiClient directly.
 *
 * Usage:
 *   const llm: ILlm = new GeminiLLM();
 *   const result = await llm.generateStructured(request, schema);
 */
export class GeminiLLM implements ILlm {
  async generateStructured<T>(
    request: GenerationRequest,
    schema: ZodSchema<T>
  ): Promise<GenerationResult<T>> {
    // Lazy import to avoid circular dependency issues at module load time
    const { getGeminiClient } = await import("../gemini/client");
    return getGeminiClient().generateStructured(request, schema);
  }
}

/**
 * Returns the default LLM instance for OpsMind.
 * Currently always returns a GeminiLLM.
 *
 * Future: could return different implementations based on config.
 */
export function getDefaultLlm(): ILlm {
  return new GeminiLLM();
}
