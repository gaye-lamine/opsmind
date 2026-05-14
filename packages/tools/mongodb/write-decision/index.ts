import { z } from "zod";
import { createLogger, generateDecisionId, generateFindingId, generateActionId, scoreToConfidenceLevel } from "@opsmind/shared";
import { DecisionRepository } from "@opsmind/memory";
import { type DecisionDocument } from "@opsmind/memory";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../../registry/tool.interface";

const logger = createLogger("WriteDecisionTool");

// ─── Input Schema ─────────────────────────────────────────────────────────────

const findingInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["info", "warning", "critical"]),
  evidence: z.array(z.string()),
  relatedMetrics: z.array(z.string()).optional(),
});

const recommendationInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  rationale: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "immediate"]),
  estimatedImpact: z.string(),
  timeframe: z.string(),
  risks: z.array(z.string()).optional(),
});

const writeDecisionInputSchema = z.object({
  sessionId: z.string().min(1),
  goal: z.string().min(1),
  category: z.enum([
    "anomaly_resolution",
    "strategic_recommendation",
    "operational_action",
    "risk_mitigation",
    "performance_optimization",
    "monitoring_alert",
  ]),
  summary: z.string().min(1),
  reasoning: z.string().min(1),
  findings: z.array(findingInputSchema).min(1),
  recommendations: z.array(recommendationInputSchema),
  confidenceScore: z.number().min(0).max(1),
  toolsUsed: z.array(z.string()),
  memoryReferences: z.array(z.string()),
  reasoningSteps: z.array(
    z.object({
      step: z.string(),
      summary: z.string(),
      durationMs: z.number(),
    })
  ),
  modelUsed: z.string().default("gemini-2.5-pro"),
});

type WriteDecisionInput = z.infer<typeof writeDecisionInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const writeDecisionOutputSchema = z.object({
  decisionId: z.string(),
  status: z.string(),
  confidenceLevel: z.enum(["low", "medium", "high", "very_high"]),
  findingsCount: z.number(),
  recommendationsCount: z.number(),
  persistedAt: z.string(),
});

type WriteDecisionOutput = z.infer<typeof writeDecisionOutputSchema>;

// ─── Tool Implementation ──────────────────────────────────────────────────────

/**
 * WriteDecisionTool — persists a structured decision to MongoDB operational memory.
 *
 * Called by the agent at the decision_synthesis step after reasoning is complete.
 * The decision is stored with full reasoning trace for future memory retrieval.
 *
 * This tool is the primary mechanism by which OpsMind builds its organizational memory.
 */
export class WriteDecisionTool extends BaseTool<WriteDecisionInput, WriteDecisionOutput> {
  readonly name = "write_decision";
  readonly description =
    "Persists a structured decision to operational memory. " +
    "Call this after completing reasoning to store findings, recommendations, " +
    "and the full reasoning trace. This builds the organizational memory that " +
    "improves future decision-making.";
  readonly category = "memory_write" as const;
  readonly inputSchema = writeDecisionInputSchema;
  readonly outputSchema = writeDecisionOutputSchema;

  private readonly decisionRepo = new DecisionRepository();

  protected async run(input: WriteDecisionInput): Promise<ToolResult<WriteDecisionOutput>> {
    const decisionId = generateDecisionId();
    const now = new Date();
    const confidenceLevel = scoreToConfidenceLevel(input.confidenceScore);

    logger.info("Writing decision to memory", {
      decisionId,
      sessionId: input.sessionId,
      category: input.category,
      confidenceScore: input.confidenceScore,
    });

    const document: DecisionDocument = {
      _id: decisionId,
      sessionId: input.sessionId,
      goal: input.goal,
      category: input.category,
      status: "pending_reflection",
      summary: input.summary,
      reasoning: input.reasoning,
      findings: input.findings.map((f) => ({
        id: generateFindingId(),
        title: f.title,
        description: f.description,
        severity: f.severity,
        evidence: f.evidence,
        ...(f.relatedMetrics !== undefined ? { relatedMetrics: f.relatedMetrics } : {}),
      })),
      recommendations: input.recommendations.map((r) => ({
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
      confidenceScore: input.confidenceScore,
      confidenceLevel,
      reasoningTrace: {
        steps: input.reasoningSteps.map((s) => ({
          step: s.step,
          input: s.summary,
          output: s.summary,
          durationMs: s.durationMs,
          timestamp: now,
        })),
        totalDurationMs: input.reasoningSteps.reduce((sum, s) => sum + s.durationMs, 0),
        modelUsed: input.modelUsed,
      },
      toolsUsed: input.toolsUsed,
      memoryReferences: input.memoryReferences,
      createdAt: now,
      updatedAt: now,
    };

    const inserted = await this.decisionRepo.insertOne(document);

    if (!inserted) {
      return toolFailure(
        "MEMORY_WRITE_FAILED",
        "Failed to persist decision to MongoDB",
        0
      );
    }

    return toolSuccess(
      {
        decisionId,
        status: "pending_reflection",
        confidenceLevel,
        findingsCount: document.findings.length,
        recommendationsCount: document.recommendations.length,
        persistedAt: now.toISOString(),
      },
      0
    );
  }
}
