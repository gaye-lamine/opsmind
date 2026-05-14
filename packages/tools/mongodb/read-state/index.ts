import { z } from "zod";
import { createLogger } from "@opsmind/shared";
import {
  OperationalStateRepository,
  type OperationalStateDocument,
} from "@opsmind/memory";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../../registry/tool.interface";

const logger = createLogger("ReadStateTool");

// ─── Input Schema ─────────────────────────────────────────────────────────────

const readStateInputSchema = z.object({
  /**
   * "current" — returns the latest operational state snapshot
   * "history" — returns the N most recent snapshots for trend analysis
   * "range" — returns snapshots within a time range
   */
  mode: z.enum(["current", "history", "range"]).default("current"),
  /** For mode "history": number of snapshots to retrieve */
  limit: z.number().int().positive().max(20).default(5),
  /** For mode "range": ISO date string */
  from: z.string().datetime().optional(),
  /** For mode "range": ISO date string */
  to: z.string().datetime().optional(),
});

type ReadStateInput = z.infer<typeof readStateInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const businessMetricOutputSchema = z.object({
  name: z.string(),
  value: z.number(),
  unit: z.string(),
  trend: z.enum(["up", "down", "stable", "volatile"]),
  changePercent: z.number().optional(),
  period: z.string(),
  isAnomaly: z.boolean(),
});

const anomalyOutputSchema = z.object({
  id: z.string(),
  metric: z.string(),
  description: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["detected", "investigating", "resolved", "dismissed"]),
  detectedAt: z.string(),
  evidence: z.array(z.string()),
});

const stateSnapshotOutputSchema = z.object({
  id: z.string(),
  snapshotAt: z.string(),
  isCurrent: z.boolean(),
  summary: z.string(),
  metrics: z.array(businessMetricOutputSchema),
  anomalies: z.array(anomalyOutputSchema),
  activeInvestigations: z.array(z.string()),
  lastDecisionId: z.string().optional(),
});

const readStateOutputSchema = z.object({
  mode: z.enum(["current", "history", "range"]),
  snapshots: z.array(stateSnapshotOutputSchema),
  totalCount: z.number(),
  hasAnomalies: z.boolean(),
  criticalAnomalyCount: z.number(),
});

type ReadStateOutput = z.infer<typeof readStateOutputSchema>;

// ─── Tool Implementation ──────────────────────────────────────────────────────

/**
 * ReadStateTool — reads the current operational business state from MongoDB.
 *
 * This is the primary tool the agent uses at the start of every reasoning session
 * to understand the current business situation before planning.
 *
 * The agent NEVER queries MongoDB directly — it uses this tool.
 */
export class ReadStateTool extends BaseTool<ReadStateInput, ReadStateOutput> {
  readonly name = "read_operational_state";
  readonly description =
    "Reads the current operational business state from memory. " +
    "REQUIRED input: { \"mode\": \"current\" } — use mode='current' to get the latest snapshot. " +
    "Use mode='history' with limit to get recent snapshots for trend analysis. " +
    "Returns business metrics, detected anomalies, and active investigations. " +
    "Always call this first at the start of any investigation.";
  readonly category = "memory_read" as const;
  readonly inputSchema = readStateInputSchema;
  readonly outputSchema = readStateOutputSchema;

  private readonly stateRepo = new OperationalStateRepository();

  protected async run(input: ReadStateInput): Promise<ToolResult<ReadStateOutput>> {
    logger.debug("Reading operational state", { mode: input.mode });

    let snapshots: OperationalStateDocument[] = [];

    switch (input.mode) {
      case "current": {
        const current = await this.stateRepo.findCurrent();
        if (current) snapshots = [current];
        break;
      }
      case "history": {
        snapshots = await this.stateRepo.findRecentSnapshots(input.limit);
        break;
      }
      case "range": {
        if (!input.from || !input.to) {
          return toolFailure(
            "INVALID_INPUT",
            "mode 'range' requires both 'from' and 'to' parameters",
            0
          );
        }
        snapshots = await this.stateRepo.findInTimeRange(
          new Date(input.from),
          new Date(input.to)
        );
        break;
      }
    }

    const serialized = snapshots.map((s) => ({
      id: s._id,
      snapshotAt: s.snapshotAt.toISOString(),
      isCurrent: s.isCurrent,
      summary: s.summary,
      metrics: s.metrics,
      anomalies: s.anomalies.map((a) => ({
        id: a.id,
        metric: a.metric,
        description: a.description,
        severity: a.severity,
        status: a.status,
        detectedAt: a.detectedAt.toISOString(),
        evidence: a.evidence,
      })),
      activeInvestigations: s.activeInvestigations,
      ...(s.lastDecisionId !== undefined ? { lastDecisionId: s.lastDecisionId } : {}),
    }));

    const allAnomalies = snapshots.flatMap((s) => s.anomalies);
    const criticalCount = allAnomalies.filter(
      (a) => a.severity === "critical" && a.status !== "resolved"
    ).length;

    return toolSuccess(
      {
        mode: input.mode,
        snapshots: serialized,
        totalCount: serialized.length,
        hasAnomalies: allAnomalies.some((a) => a.status !== "resolved"),
        criticalAnomalyCount: criticalCount,
      },
      0
    );
  }
}
