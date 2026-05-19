import { z } from "zod";
import { createLogger } from "@opsmind/shared";
import { OperationalStateRepository } from "@opsmind/memory";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../registry/tool.interface";

const logger = createLogger("MetricAnalyzerTool");

// ─── Input Schema ─────────────────────────────────────────────────────────────

const metricAnalyzerInputSchema = z.object({
  /**
   * Specific metric names to analyze. If empty, analyzes all metrics.
   */
  metricNames: z.array(z.string()).default([]),
  /**
   * Number of historical snapshots to include in trend analysis.
   */
  historyDepth: z.number().int().positive().default(5).transform((v) => Math.min(v, 100)),
  /**
   * Whether to run anomaly detection on the metrics.
   */
  detectAnomalies: z.boolean().default(true),
  /**
   * Z-score threshold for anomaly detection (default: 2.0 = 2 standard deviations).
   */
  anomalyThreshold: z.number().positive().default(2.0),
});

type MetricAnalyzerInput = z.infer<typeof metricAnalyzerInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const metricTrendSchema = z.object({
  name: z.string(),
  currentValue: z.number(),
  unit: z.string(),
  trend: z.enum(["up", "down", "stable", "volatile"]),
  changePercent: z.number().optional(),
  period: z.string(),
  isAnomaly: z.boolean(),
  historicalValues: z.array(
    z.object({
      value: z.number(),
      snapshotAt: z.string(),
    })
  ),
  statistics: z.object({
    mean: z.number(),
    min: z.number(),
    max: z.number(),
    volatility: z.number(),
  }),
});

const detectedAnomalySchema = z.object({
  metricName: z.string(),
  currentValue: z.number(),
  expectedRange: z.object({ min: z.number(), max: z.number() }),
  deviationMagnitude: z.number(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: z.string(),
});

const metricAnalyzerOutputSchema = z.object({
  analyzedMetrics: z.array(metricTrendSchema),
  detectedAnomalies: z.array(detectedAnomalySchema),
  anomalyCount: z.number(),
  criticalAnomalyCount: z.number(),
  overallHealthScore: z.number().min(0).max(1),
  analysisTimestamp: z.string(),
});

type MetricAnalyzerOutput = z.infer<typeof metricAnalyzerOutputSchema>;

// ─── Tool Implementation ──────────────────────────────────────────────────────

/**
 * MetricAnalyzerTool — analyzes business metrics for trends and anomalies.
 *
 * Reads historical state snapshots from MongoDB and computes:
 * - Trend direction and magnitude for each metric
 * - Statistical baseline (mean, std dev, min, max)
 * - Anomaly detection using z-score analysis
 * - Overall business health score
 *
 * This is a core analytical capability used during the business_analysis workflow.
 */
export class MetricAnalyzerTool extends BaseTool<MetricAnalyzerInput, MetricAnalyzerOutput> {
  readonly name = "analyze_metrics";
  readonly description =
    "Analyzes high-level operational state snapshots for general health trends. " +
    "REQUIRED input: { \"metricNames\": [], \"historyDepth\": 5 }. " +
    "NOTE: This tool only provides a global summary. For deep drill-down, root cause analysis, or investigating specific user cohorts, " +
    "you MUST use mongodb_list_collections, mongodb_schema, and mongodb_query on the raw data collections.";
  readonly category = "analytics" as const;
  readonly inputSchema = metricAnalyzerInputSchema;
  readonly outputSchema = metricAnalyzerOutputSchema;

  private readonly stateRepo = new OperationalStateRepository();

  protected async run(input: MetricAnalyzerInput): Promise<ToolResult<MetricAnalyzerOutput>> {
    logger.debug("Analyzing metrics", {
      metricNames: input.metricNames,
      historyDepth: input.historyDepth,
    });

    const snapshots = await this.stateRepo.findRecentSnapshots(input.historyDepth);

    if (snapshots.length === 0) {
      return toolFailure(
        "NO_STATE_DATA",
        "No operational state snapshots found. Cannot analyze metrics.",
        0
      );
    }

    const currentSnapshot = snapshots[0];
    if (!currentSnapshot) {
      return toolFailure("NO_CURRENT_STATE", "No current state snapshot available", 0);
    }

    // Filter metrics if specific names requested
    const metricsToAnalyze =
      input.metricNames.length > 0
        ? currentSnapshot.metrics.filter((m) =>
            input.metricNames.includes(m.name)
          )
        : currentSnapshot.metrics;

    // Build historical value series per metric
    const historicalByMetric = new Map<string, Array<{ value: number; snapshotAt: string }>>();

    for (const snapshot of snapshots) {
      for (const metric of snapshot.metrics) {
        if (!historicalByMetric.has(metric.name)) {
          historicalByMetric.set(metric.name, []);
        }
        historicalByMetric.get(metric.name)!.push({
          value: metric.value,
          snapshotAt: snapshot.snapshotAt.toISOString(),
        });
      }
    }

    // Analyze each metric
    const analyzedMetrics = metricsToAnalyze.map((metric) => {
      const history = historicalByMetric.get(metric.name) ?? [];
      const values = history.map((h) => h.value);
      const stats = computeStatistics(values);

      return {
        name: metric.name,
        currentValue: metric.value,
        unit: metric.unit,
        trend: metric.trend,
        ...(metric.changePercent !== undefined ? { changePercent: metric.changePercent } : {}),
        period: metric.period,
        isAnomaly: metric.isAnomaly,
        historicalValues: history,
        statistics: stats,
      };
    });

    // Detect anomalies using the database flag directly instead of z-score
    const detectedAnomalies = input.detectAnomalies
      ? analyzedMetrics
          .filter((m) => m.isAnomaly)
          .map((m) => {
            const history = historicalByMetric.get(m.name) ?? [];
            const values = history.slice(1).map((h) => h.value);
            const stats = computeStatistics(values);

            // Find the original metric to access baseline
            const originalMetric = metricsToAnalyze.find((orig) => orig.name === m.name);
            const baseline = originalMetric?.baseline;

            // Determine baseline stats (use stored baseline if history depth is 1 or volatility is 0)
            const useBaseline = (values.length <= 1 || stats.volatility === 0) && baseline;
            const mean = useBaseline ? baseline.mean : stats.mean;
            const volatility = useBaseline ? baseline.stdDev : stats.volatility;

            // Calculate dynamic Z-Score
            const diff = m.currentValue - mean;
            const zScore = volatility > 0 ? Math.abs(diff / volatility) : 2.5; // fallback to 2.5 if volatility is 0

            const severity = classifyAnomalySeverity(zScore);

            return {
              metricName: m.name,
              currentValue: m.currentValue,
              expectedRange: {
                min: mean - input.anomalyThreshold * volatility,
                max: mean + input.anomalyThreshold * volatility,
              },
              deviationMagnitude: Math.round(zScore * 10) / 10 || 2.0, // Fallback to 2.0 if zScore is 0
              severity,
              description: `${m.name} is significantly outside expected parameters at ${m.currentValue.toFixed(1)} ${m.unit} (deviation: ${zScore.toFixed(1)}σ)`,
            };
          })
      : [];

    const criticalCount = detectedAnomalies.filter(
      (a) => a.severity === "critical"
    ).length;

    // Health score: 1.0 = all healthy, decreases with anomaly count and severity
    const healthScore = Math.max(
      0,
      1 - detectedAnomalies.length * 0.1 - criticalCount * 0.2
    );

    return toolSuccess(
      {
        analyzedMetrics,
        detectedAnomalies,
        anomalyCount: detectedAnomalies.length,
        criticalAnomalyCount: criticalCount,
        overallHealthScore: Math.min(1, healthScore),
        analysisTimestamp: new Date().toISOString(),
      },
      0
    );
  }
}

// ─── Statistical Helpers ──────────────────────────────────────────────────────

function computeStatistics(values: number[]): {
  mean: number;
  min: number;
  max: number;
  volatility: number;
} {
  if (values.length === 0) {
    return { mean: 0, min: 0, max: 0, volatility: 0 };
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const volatility = Math.sqrt(variance);

  return { mean, min, max, volatility };
}

function classifyAnomalySeverity(
  zScore: number
): "low" | "medium" | "high" | "critical" {
  if (zScore >= 3.5) return "critical";
  if (zScore >= 2.5) return "high";
  if (zScore >= 1.5) return "medium";
  return "low";
}
