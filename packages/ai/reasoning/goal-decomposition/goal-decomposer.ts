import { createLogger, AIError, ERROR_CODES } from "@opsmind/shared";
import { getGeminiClient } from "../../gemini/client";
import { goalDecompositionOutputSchema, type GoalDecompositionOutput } from "../../schemas/goal-decomposition.schema";
import { OPSMIND_SYSTEM_PROMPT } from "../../prompts/system/opsmind.system.prompt";

const logger = createLogger("GoalDecomposer");

/**
 * Goal Decomposer — first step of the reasoning pipeline.
 *
 * Takes a raw user goal (e.g. "Customer acquisition costs increased by 37% this week. Investigate.")
 * and produces a structured decomposition:
 * - Goal category classification
 * - Ordered reasoning steps
 * - Initial hypotheses
 * - Focus areas (metrics, entities to investigate)
 * - Complexity and priority assessment
 *
 * This output drives the planner engine — it determines what gets investigated
 * and in what order.
 */
export class GoalDecomposer {
  private readonly client = getGeminiClient();

  async decompose(
    rawGoal: string,
    operationalContext: string,
    memoryContext: string
  ): Promise<GoalDecompositionOutput> {
    logger.info("Decomposing goal", { goal: rawGoal.slice(0, 100) });

    const systemPrompt = `${OPSMIND_SYSTEM_PROMPT}

## Your Current Role: Goal Decomposer

You receive a raw operational goal or problem statement.
Your task is to decompose it into a structured investigation plan.

## Decomposition Rules

1. Classify the goal into the most appropriate category
2. Break it into 3–6 concrete reasoning steps
3. For each step, specify which tools would be needed
4. Generate 2–4 initial hypotheses to investigate
5. Identify the key metrics and entities to focus on
6. Assess complexity and priority honestly

## Output Format

Respond with a JSON object matching this exact structure:
{
  "category": "anomaly_investigation|business_analysis|strategic_planning|operational_monitoring|risk_assessment|performance_review",
  "refinedGoal": "Structured version of the goal",
  "reasoningSteps": [
    {
      "stepNumber": 1,
      "stepType": "context_assembly|data_retrieval|anomaly_analysis|pattern_matching|causal_analysis|impact_assessment|recommendation_generation|risk_evaluation",
      "description": "What this step does",
      "requiredTools": ["tool_name"],
      "expectedOutput": "What we expect to learn"
    }
  ],
  "initialHypotheses": ["hypothesis 1", "hypothesis 2"],
  "focusAreas": ["metric or entity to investigate"],
  "complexity": "low|medium|high",
  "priority": "low|medium|high|critical"
}`;

    const userPrompt = `## Raw Goal

${rawGoal}

## Current Operational Context

${operationalContext}

## Historical Memory Context

${memoryContext}

---

Decompose this goal into a structured investigation plan.
Respond with valid JSON only.`;

    const result = await this.client.generateStructured(
      { systemPrompt, userPrompt, temperature: 0.1 },
      goalDecompositionOutputSchema
    );

    logger.info("Goal decomposed", {
      category: result.data.category,
      stepCount: result.data.reasoningSteps.length,
      complexity: result.data.complexity,
      priority: result.data.priority,
      durationMs: result.durationMs,
    });

    return result.data;
  }
}
