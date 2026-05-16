import { z } from "zod";
import { createLogger } from "@opsmind/shared";
import { DecisionRepository, ActionRepository } from "@opsmind/memory";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../registry/tool.interface";

const logger = createLogger("DecisionRetrieverTool");

// ─── Input Schema ─────────────────────────────────────────────────────────────

const decisionRetrieverInputSchema = z.object({
  /**
   * "recent" — most recent finalized decisions (DEFAULT — use this when unsure)
   * "by_category" — decisions of a specific category
   * "by_metric" — decisions that referenced a specific metric
   * "by_session" — all decisions from a specific session
   */
  mode: z.enum(["recent", "by_category", "by_metric", "by_session"]).default("recent"),
  limit: z.number().int().positive().default(5).transform((v) => Math.min(v, 20)),
  /**
   * Only valid for mode="by_category".
   * Must be one of the decision categories — NOT goal categories.
   * If unsure, use mode="recent" instead.
   */
  category: z
    .enum([
      "anomaly_resolution",
      "strategic_recommendation",
      "operational_action",
      "risk_mitigation",
      "performance_optimization",
      "monitoring_alert",
    ])
    .optional()
    .catch(undefined),  // silently ignore invalid category values from Gemini
  metricName: z.string().optional(),
  sessionId: z.string().optional(),
});

type DecisionRetrieverInput = z.infer<typeof decisionRetrieverInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const historicalDecisionSchema = z.object({
  id: z.string(),
  goal: z.string(),
  category: z.string(),
  summary: z.string(),
  confidenceScore: z.number(),
  confidenceLevel: z.string(),
  keyFindings: z.array(
    z.object({
      title: z.string(),
      severity: z.string(),
      description: z.string(),
    })
  ),
  recommendationCount: z.number(),
  successfulActionCount: z.number(),
  createdAt: z.string(),
});

const decisionRetrieverOutputSchema = z.object({
  decisions: z.array(historicalDecisionSchema),
  totalRetrieved: z.number(),
  mode: z.string(),
  patternInsights: z.array(z.string()),
});

type DecisionRetrieverOutput = z.infer<typeof decisionRetrieverOutputSchema>;

// ─── Tool Implementation ──────────────────────────────────────────────────────

/**
 * DecisionRetrieverTool — retrieves historical decisions for context and pattern analysis.
 *
 * Used by the agent during context assembly and goal decomposition to understand
 * what decisions were made in similar situations and what outcomes resulted.
 *
 * This is the primary tool for accessing organizational memory during reasoning.
 */
export class DecisionRetrieverTool extends BaseTool<
  DecisionRetrieverInput,
  DecisionRetrieverOutput
> {
  readonly name = "retrieve_decisions";
  readonly description =
    "Retrieves historical decisions from organizational memory. " +
    "REQUIRED input: { \"mode\": \"recent\" | \"by_category\" | \"by_metric\" | \"by_session\", \"limit\": 5 }. " +
    "Use mode='recent' to get the latest decisions for context (most common). " +
    "Use mode='by_category' with category field to find precedents for similar problem types. " +
    "Use mode='by_metric' with metricName field to find decisions that addressed a specific metric anomaly. " +
    "Use mode='by_session' with sessionId field to get all decisions from a specific investigation.";
  readonly category = "memory_read" as const;
  readonly inputSchema = decisionRetrieverInputSchema;
  readonly outputSchema = decisionRetrieverOutputSchema;

  private readonly decisionRepo = new DecisionRepository();
  private readonly actionRepo = new ActionRepository();

  protected async run(
    input: DecisionRetrieverInput
  ): Promise<ToolResult<DecisionRetrieverOutput>> {
    logger.debug("Retrieving decisions", { mode: input.mode });

    let decisions;

    switch (input.mode) {
      case "recent":
        decisions = await this.decisionRepo.findRecentFinalized(input.limit);
        break;

      case "by_category":
        if (!input.category) {
          // Fallback to recent if category is missing or was invalid
          decisions = await this.decisionRepo.findRecentFinalized(input.limit);
          break;
        }
        decisions = await this.decisionRepo.findByCategory(input.category, input.limit);
        break;

      case "by_metric":
        if (!input.metricName) {
          return toolFailure(
            "INVALID_INPUT",
            "mode 'by_metric' requires 'metricName' parameter",
            0
          );
        }
        decisions = await this.decisionRepo.findByMetricReference(input.metricName);
        break;

      case "by_session":
        if (!input.sessionId) {
          return toolFailure(
            "INVALID_INPUT",
            "mode 'by_session' requires 'sessionId' parameter",
            0
          );
        }
        decisions = await this.decisionRepo.findBySessionId(input.sessionId);
        break;
    }

    // For each decision, count successful actions to surface outcome quality
    const enriched = await Promise.all(
      decisions.map(async (d) => {
        const actions = await this.actionRepo.findByDecisionId(d._id);
        const successfulCount = actions.filter(
          (a) => a.outcome?.wasSuccessful === true
        ).length;

        return {
          id: d._id,
          goal: d.goal,
          category: d.category,
          summary: d.summary,
          confidenceScore: d.confidenceScore,
          confidenceLevel: d.confidenceLevel,
          keyFindings: d.findings.slice(0, 3).map((f) => ({
            title: f.title,
            severity: f.severity,
            description: f.description,
          })),
          recommendationCount: d.recommendations.length,
          successfulActionCount: successfulCount,
          createdAt: d.createdAt.toISOString(),
        };
      })
    );

    // Extract pattern insights from the retrieved decisions
    const patternInsights = extractPatternInsights(enriched);

    return toolSuccess(
      {
        decisions: enriched,
        totalRetrieved: enriched.length,
        mode: input.mode,
        patternInsights,
      },
      0
    );
  }
}

// ─── Pattern Extraction ───────────────────────────────────────────────────────

function extractPatternInsights(
  decisions: Array<{
    category: string;
    confidenceScore: number;
    successfulActionCount: number;
    recommendationCount: number;
  }>
): string[] {
  const insights: string[] = [];

  if (decisions.length === 0) return insights;

  // Average confidence
  const avgConfidence =
    decisions.reduce((sum, d) => sum + d.confidenceScore, 0) / decisions.length;
  insights.push(
    `Historical decisions in this area have an average confidence of ${(avgConfidence * 100).toFixed(0)}%`
  );

  // Category distribution
  const categoryCounts = new Map<string, number>();
  for (const d of decisions) {
    categoryCounts.set(d.category, (categoryCounts.get(d.category) ?? 0) + 1);
  }
  const topCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCategory) {
    insights.push(
      `Most common decision type: ${topCategory[0]} (${topCategory[1]} occurrences)`
    );
  }

  // Action success rate
  const totalActions = decisions.reduce((sum, d) => sum + d.recommendationCount, 0);
  const successfulActions = decisions.reduce(
    (sum, d) => sum + d.successfulActionCount,
    0
  );
  if (totalActions > 0) {
    const successRate = (successfulActions / totalActions) * 100;
    insights.push(
      `Action success rate from similar decisions: ${successRate.toFixed(0)}%`
    );
  }

  return insights;
}
