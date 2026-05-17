import { createLogger, clampConfidence } from "@opsmind/shared";
import { Decision } from "@opsmind/shared";
import { getGeminiClient } from "../../gemini/client";
import { reflectionOutputSchema, type ReflectionOutput } from "../../schemas/reflection.schema";
import { type DecisionSynthesisOutput } from "../../schemas/decision-synthesis.schema";
import {
  EVALUATOR_SYSTEM_PROMPT,
  buildEvaluatorUserPrompt,
} from "../../prompts/evaluator/evaluator.prompt";
import { type ToolResultSummary } from "../../prompts/decision/decision.prompt";

const logger = createLogger("ReflectionLoop");

/**
 * Reflection Loop — mandatory seventh step of the reasoning pipeline.
 *
 * Rule §2.4: Every important decision MUST go through reflection.
 * Reflection is NOT optional.
 *
 * The reflector acts as an independent critic of the synthesized decision.
 * It evaluates:
 * - Evidence quality and reasoning coherence
 * - Confidence calibration
 * - Recommendation quality and risks
 * - Alternative approaches not considered
 * - Limitations of the analysis
 *
 * Output: an updated Decision with reflection attached and confidence adjusted.
 *
 * If the reflection assessment is "needs_revision", the decision is still
 * finalized but the revision requirements are preserved in the reflection
 * for transparency. In a future version, this could trigger a re-planning loop.
 */

export interface ReflectionResult {
  reflection: ReflectionOutput;
  updatedDecision: Decision;
  confidenceAdjusted: boolean;
  confidenceDelta: number;
}

export class ReflectionLoop {
  private readonly client = getGeminiClient();

  async reflect(
    decision: Decision,
    synthesisOutput: DecisionSynthesisOutput,
    toolResults: ToolResultSummary[],
    memoryContext: string
  ): Promise<ReflectionResult> {
    logger.info("Starting reflection loop", {
      decisionId: decision.id,
      originalConfidence: decision.confidenceScore,
    });

    const toolResultsSummary = toolResults
      .map((r) => `[${r.success ? "OK" : "FAIL"}] ${r.toolName}: ${r.result.slice(0, 150)}...`)
      .join("\n");

    const userPrompt = buildEvaluatorUserPrompt({
      rawGoal: decision.goal,
      decision: synthesisOutput,
      toolResultsSummary,
      memoryContext,
    });

    const result = await this.client.generateStructured(
      {
        systemPrompt: EVALUATOR_SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.15, // Slightly higher for critical thinking
      },
      reflectionOutputSchema
    );

    const reflection = result.data;
    const originalConfidence = decision.confidenceScore;
    const adjustedConfidence = clampConfidence(reflection.adjustedConfidenceScore);
    const confidenceDelta = adjustedConfidence - originalConfidence;

    logger.info("Reflection completed", {
      decisionId: decision.id,
      assessment: reflection.overallAssessment,
      reasoningQuality: reflection.reasoningQuality,
      originalConfidence,
      adjustedConfidence,
      confidenceDelta: confidenceDelta.toFixed(3),
      risksIdentified: reflection.identifiedRisks.length,
      durationMs: result.durationMs,
    });

    if (reflection.overallAssessment === "needs_revision") {
      logger.warn("Decision flagged for revision", {
        decisionId: decision.id,
        revisionRequirements: reflection.revisionRequirements,
      });
    }

    // Build the DecisionReflection object to attach to the decision
    const decisionReflection: Decision["reflection"] = {
      confidenceAssessment: reflection.confidenceAssessment,
      reasoningQuality: reflection.reasoningQualityNotes,
      identifiedRisks: reflection.identifiedRisks,
      alternativeApproaches: reflection.alternativeApproaches,
      limitations: reflection.limitations,
      improvementSuggestions: reflection.improvementSuggestions,
      overallScore: reflection.overallScore,
    };

    // Update the decision with reflection and adjusted confidence
    const updatedDecision: Decision = {
      ...decision,
      reflection: decisionReflection,
      confidenceScore: adjustedConfidence,
      status: "finalized",
      updatedAt: new Date(),
    };

    return {
      reflection,
      updatedDecision,
      confidenceAdjusted: Math.abs(confidenceDelta) > 0.01,
      confidenceDelta,
    };
  }
}
