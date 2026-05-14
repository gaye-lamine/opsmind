import { OPSMIND_SYSTEM_PROMPT } from "../system/opsmind.system.prompt";
import { type GoalDecompositionOutput } from "../../schemas/goal-decomposition.schema";

/**
 * Decision Synthesis Prompt — v1.0
 *
 * Builds the prompt for the decision engine.
 * The decision engine synthesizes all tool execution results
 * into a structured decision with findings and recommendations.
 *
 * Rule §6.1: This prompt is ONLY for decision synthesis.
 */

export const DECISION_SYSTEM_PROMPT = `${OPSMIND_SYSTEM_PROMPT}

## Your Current Role: Decision Synthesizer

You have completed an operational investigation. You now have:
- Tool execution results from the investigation
- Historical context from organizational memory
- Anomaly analysis and metric data

Your task is to synthesize all of this into a structured decision.

## Synthesis Rules

1. Ground every finding in specific evidence from the tool results
2. Do not invent data — only use what the tools returned
3. Prioritize findings by severity and business impact
4. Make recommendations specific and actionable — not generic advice
5. Assign confidence based on evidence quality, not optimism
6. Identify the root cause, not just the symptoms
7. Predict what happens if no action is taken

## Confidence Scoring Guide

- 0.9–1.0: Multiple corroborating data sources, clear causal chain
- 0.7–0.9: Strong evidence, minor gaps in data
- 0.5–0.7: Moderate evidence, some assumptions required
- 0.3–0.5: Limited data, significant uncertainty
- 0.0–0.3: Insufficient data, highly speculative

## Output Format

Respond with a JSON object matching this exact structure:
{
  "summary": "Executive summary paragraph",
  "reasoning": "Full reasoning narrative explaining how you reached this decision",
  "findings": [
    {
      "title": "Finding title",
      "description": "Detailed description",
      "severity": "info|warning|critical",
      "evidence": ["specific evidence item 1", "specific evidence item 2"],
      "relatedMetrics": ["metric_name"]
    }
  ],
  "recommendations": [
    {
      "title": "Action title",
      "description": "What to do",
      "rationale": "Why this action addresses the finding",
      "priority": "low|medium|high|immediate",
      "estimatedImpact": "Expected outcome",
      "timeframe": "When to execute",
      "risks": ["potential risk"]
    }
  ],
  "confidenceScore": 0.0,
  "confidenceRationale": "Why this confidence level",
  "rootCauseAnalysis": "Root cause explanation",
  "predictedImpactIfUnaddressed": "What happens if nothing is done"
}`;

export interface DecisionUserPromptParams {
  goal: GoalDecompositionOutput;
  rawGoal: string;
  toolResults: ToolResultSummary[];
  memoryContext: string;
  operationalContext: string;
}

export interface ToolResultSummary {
  toolName: string;
  stepDescription: string;
  result: string;
  success: boolean;
}

export function buildDecisionUserPrompt(params: DecisionUserPromptParams): string {
  const toolResultsText = params.toolResults
    .map(
      (r, i) =>
        `### Step ${i + 1}: ${r.toolName}
Description: ${r.stepDescription}
Status: ${r.success ? "SUCCESS" : "FAILED"}
Result:
${r.result}`
    )
    .join("\n\n");

  return `## Investigation Goal

${params.rawGoal}

## Goal Category
${params.goal.category}

## Initial Hypotheses (to validate or refute)
${params.goal.initialHypotheses.map((h) => `- ${h}`).join("\n")}

## Tool Execution Results

${toolResultsText}

## Current Operational Context
${params.operationalContext}

## Historical Memory Context
${params.memoryContext}

---

Synthesize all of the above into a structured decision.
Base every finding on specific evidence from the tool results.
Respond with valid JSON only.`;
}
