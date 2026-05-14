import { z } from "zod";
import { createLogger } from "@opsmind/shared";
import { getEnv } from "@opsmind/config";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../registry/tool.interface";

const logger = createLogger("TriggerInvestigationTool");

// ─── Input Schema ─────────────────────────────────────────────────────────────

const triggerInvestigationInputSchema = z.object({
  /**
   * The goal for the follow-up investigation.
   * Should be specific and actionable based on the current findings.
   */
  goal: z.string().min(10).max(2000),
  /**
   * Domain context for the investigation.
   */
  domain: z.string().optional(),
  /**
   * Specific metrics to focus on.
   */
  metrics: z.array(z.string()).default([]),
  /**
   * The reason this follow-up was triggered (for traceability).
   */
  reason: z.string().optional(),
  /**
   * The parent decision ID that triggered this investigation.
   */
  parentDecisionId: z.string().optional(),
});

type TriggerInvestigationInput = z.infer<typeof triggerInvestigationInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const triggerInvestigationOutputSchema = z.object({
  sessionId: z.string(),
  goal: z.string(),
  status: z.string(),
  triggeredAt: z.string(),
  parentDecisionId: z.string().optional(),
  executedVia: z.literal("opsmind-agent-api"),
});

type TriggerInvestigationOutput = z.infer<typeof triggerInvestigationOutputSchema>;

// ─── Tool Implementation ──────────────────────────────────────────────────────

/**
 * TriggerInvestigationTool — launches a follow-up agent investigation.
 *
 * This is a REAL ACTION tool — it calls the OpsMind API to start a new
 * agent session. This creates autonomous agent chains:
 *
 *   Investigation A → finds insufficient data → triggers Investigation B
 *   Investigation B → finds root cause → triggers remediation actions
 *
 * This is what makes OpsMind truly autonomous: the agent can decide to
 * investigate further without human intervention.
 *
 * Use when:
 * - The current investigation found insufficient data for root cause analysis
 * - A finding requires deeper investigation of a specific metric or system
 * - The reflection loop flagged the decision as "needs_revision"
 * - A critical anomaly requires immediate parallel investigation
 */
export class TriggerInvestigationTool extends BaseTool<TriggerInvestigationInput, TriggerInvestigationOutput> {
  readonly name = "trigger_followup_investigation";
  readonly description =
    "[ACTION] Launches a new autonomous agent investigation — a REAL ACTION that starts a new agent session. " +
    "REQUIRED input: { \"goal\": \"<specific investigation goal>\", \"reason\": \"<why this follow-up is needed>\" }. " +
    "Use this when the current investigation found insufficient data, needs deeper analysis, or identified a new problem requiring investigation. " +
    "The new investigation runs autonomously and its results are stored in organizational memory. " +
    "This creates an autonomous agent chain — the agent investigates further without human intervention.";
  readonly category = "system" as const;
  readonly inputSchema = triggerInvestigationInputSchema;
  readonly outputSchema = triggerInvestigationOutputSchema;

  protected async run(input: TriggerInvestigationInput): Promise<ToolResult<TriggerInvestigationOutput>> {
    const env = getEnv();
    const apiBaseUrl = env.API_BASE_URL ?? "http://localhost:3001";

    logger.info("Triggering follow-up investigation", {
      goal: input.goal.slice(0, 100),
      domain: input.domain,
      metrics: input.metrics,
      reason: input.reason,
      parentDecisionId: input.parentDecisionId,
    });

    const start = Date.now();

    try {
      // Enrich the goal with context from the parent investigation
      const enrichedGoal = input.parentDecisionId
        ? `[Follow-up from decision ${input.parentDecisionId}] ${input.goal}${input.reason ? ` Reason: ${input.reason}` : ""}`
        : input.goal;

      const requestBody = {
        goal: enrichedGoal,
        context: {
          domain: input.domain ?? "anomaly_investigation",
          ...(input.metrics.length > 0 ? { metrics: input.metrics } : {}),
        },
      };

      const response = await fetch(`${apiBaseUrl}/api/agent/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-triggered-by": "agent-action",
        },
        body: JSON.stringify(requestBody),
      });

      const durationMs = Date.now() - start;

      if (!response.ok) {
        const errorText = await response.text();
        return toolFailure(
          "INVESTIGATION_TRIGGER_FAILED",
          `Failed to trigger investigation: HTTP ${response.status} — ${errorText.slice(0, 200)}`,
          durationMs
        );
      }

      const result = await response.json() as {
        success: boolean;
        data?: { sessionId: string; decisionId?: string; status: string };
        error?: { message: string };
      };

      if (!result.success || !result.data) {
        return toolFailure(
          "INVESTIGATION_TRIGGER_FAILED",
          result.error?.message ?? "Investigation trigger returned no data",
          durationMs
        );
      }

      const triggeredAt = new Date().toISOString();

      logger.info("Follow-up investigation triggered successfully", {
        sessionId: result.data.sessionId,
        goal: input.goal.slice(0, 100),
        durationMs,
      });

      return toolSuccess(
        {
          sessionId: result.data.sessionId,
          goal: input.goal,
          status: result.data.status,
          triggeredAt,
          ...(input.parentDecisionId !== undefined ? { parentDecisionId: input.parentDecisionId } : {}),
          executedVia: "opsmind-agent-api",
        },
        durationMs
      );
    } catch (error) {
      const durationMs = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);

      logger.error("Failed to trigger follow-up investigation", error instanceof Error ? error : undefined);

      return toolFailure(
        "INVESTIGATION_TRIGGER_FAILED",
        `Failed to trigger investigation: ${message}`,
        durationMs
      );
    }
  }
}
