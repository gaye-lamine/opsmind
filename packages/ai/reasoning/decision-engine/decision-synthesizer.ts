import { createLogger, generateDecisionId, generateFindingId, generateActionId, scoreToConfidenceLevel } from "@opsmind/shared";
import { type Decision } from "@opsmind/shared";
import { getGeminiClient } from "../../gemini/client";
import { getCloudConfig } from "@opsmind/config";
import { decisionSynthesisOutputSchema, type DecisionSynthesisOutput } from "../../schemas/decision-synthesis.schema";
import { type GoalDecompositionOutput } from "../../schemas/goal-decomposition.schema";
import {
  DECISION_SYSTEM_PROMPT,
  buildDecisionUserPrompt,
  type ToolResultSummary,
} from "../../prompts/decision/decision.prompt";

const logger = createLogger("DecisionSynthesizer");

/**
 * Decision Synthesizer — sixth step of the reasoning pipeline (after execution).
 *
 * Takes all tool execution results and synthesizes them into a structured Decision.
 * This is the primary intelligence output of OpsMind — the artifact that gets
 * persisted to MongoDB and surfaces to the user.
 *
 * The synthesizer:
 * 1. Grounds findings in specific tool result evidence
 * 2. Generates actionable recommendations with priorities
 * 3. Performs root cause analysis
 * 4. Assigns a calibrated confidence score
 * 5. Predicts impact if unaddressed
 */

export interface SynthesisInput {
  rawGoal: string;
  sessionId: string;
  decomposedGoal: GoalDecompositionOutput;
  toolResults: ToolResultSummary[];
  operationalContext: string;
  memoryContext: string;
  toolsUsed: string[];
  memoryReferences: string[];
  reasoningStepsSummary: Array<{
    step: string;
    summary: string;
    durationMs: number;
  }>;
  totalDurationMs: number;
}

export class DecisionSynthesizer {
  private readonly client = getGeminiClient();

  async synthesize(input: SynthesisInput): Promise<Decision> {
    logger.info("Synthesizing decision", {
      sessionId: input.sessionId,
      goal: input.rawGoal.slice(0, 100),
      toolResultCount: input.toolResults.length,
    });

    const userPrompt = buildDecisionUserPrompt({
      goal: input.decomposedGoal,
      rawGoal: input.rawGoal,
      toolResults: input.toolResults,
      memoryContext: input.memoryContext,
      operationalContext: input.operationalContext,
    });

    const result = await this.client.generateStructured(
      {
        systemPrompt: DECISION_SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.2,
      },
      decisionSynthesisOutputSchema
    );

    const synthesized: DecisionSynthesisOutput = result.data;
    const now = new Date();
    const decisionId = generateDecisionId();
    const confidenceLevel = scoreToConfidenceLevel(synthesized.confidenceScore);

    // Map synthesized output to the full Decision domain type
    const decision: Decision = {
      id: decisionId,
      sessionId: input.sessionId,
      goal: input.rawGoal,
      category: mapCategoryToDecisionCategory(input.decomposedGoal.category),
      status: "pending_reflection",
      summary: synthesized.summary,
      reasoning: synthesized.reasoning,
      findings: synthesized.findings.map((f) => ({
        id: generateFindingId(),
        title: f.title,
        description: f.description,
        severity: f.severity,
        evidence: f.evidence,
        ...(f.relatedMetrics !== undefined ? { relatedMetrics: f.relatedMetrics } : {}),
      })),
      recommendations: synthesized.recommendations.map((r) => ({
        id: generateActionId(),
        title: r.title,
        description: r.description,
        rationale: r.rationale,
        priority: r.priority,
        status: "recommended" as const,
        estimatedImpact: r.estimatedImpact,
        timeframe: r.timeframe,
        ...(r.risks !== undefined ? { risks: r.risks } : {}),
      })),
      confidenceScore: synthesized.confidenceScore,
      confidenceLevel,
      reasoningTrace: {
        steps: input.reasoningStepsSummary.map((s) => ({
          step: s.step,
          input: s.summary,
          output: s.summary,
          durationMs: s.durationMs,
          timestamp: now,
        })),
        totalDurationMs: input.totalDurationMs,
        modelUsed: getCloudConfig().gemini.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      },
      toolsUsed: input.toolsUsed,
      memoryReferences: input.memoryReferences,
      createdAt: now,
      updatedAt: now,
    };

    logger.info("Decision synthesized", {
      decisionId,
      category: decision.category,
      findingsCount: decision.findings.length,
      recommendationsCount: decision.recommendations.length,
      confidenceScore: decision.confidenceScore,
      confidenceLevel,
      durationMs: result.durationMs,
    });

    return decision;
  }
}

// ─── Category Mapping ─────────────────────────────────────────────────────────

function mapCategoryToDecisionCategory(
  goalCategory: GoalDecompositionOutput["category"]
): Decision["category"] {
  const mapping: Record<GoalDecompositionOutput["category"], Decision["category"]> = {
    anomaly_investigation: "anomaly_resolution",
    business_analysis: "strategic_recommendation",
    strategic_planning: "strategic_recommendation",
    operational_monitoring: "operational_action",
    risk_assessment: "risk_mitigation",
    performance_review: "performance_optimization",
  };
  return mapping[goalCategory];
}
