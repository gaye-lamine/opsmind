import { z } from "zod";
import { createLogger } from "@opsmind/shared";
import { getEnv } from "@opsmind/config";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../registry/tool.interface";

const logger = createLogger("PublishAlertTool");

// ─── Input Schema ─────────────────────────────────────────────────────────────

const publishAlertInputSchema = z.object({
  /**
   * Severity of the alert — determines routing and urgency.
   */
  severity: z.enum(["low", "medium", "high", "critical"]),
  /**
   * Short title of the alert (shown in notification systems).
   */
  title: z.string().min(1).max(200),
  /**
   * Full description of what triggered the alert.
   */
  description: z.string().min(1),
  /**
   * The metric or system that is affected.
   */
  affectedMetric: z.string().optional(),
  /**
   * The decision ID that triggered this alert.
   */
  decisionId: z.string().optional(),
  /**
   * The session ID of the investigation that produced this alert.
   */
  sessionId: z.string().optional(),
  /**
   * Recommended immediate actions (from the decision recommendations).
   */
  recommendedActions: z.array(z.string()).default([]),
});

type PublishAlertInput = z.infer<typeof publishAlertInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const publishAlertOutputSchema = z.object({
  messageId: z.string(),
  topicId: z.string(),
  publishedAt: z.string(),
  severity: z.string(),
  title: z.string(),
  executedVia: z.literal("google-cloud-pubsub"),
});

type PublishAlertOutput = z.infer<typeof publishAlertOutputSchema>;

// ─── Tool Implementation ──────────────────────────────────────────────────────

/**
 * PublishAlertTool — publishes operational alerts to Google Cloud Pub/Sub.
 *
 * This is a REAL ACTION tool — it executes in a real external system.
 * When the agent detects a critical anomaly or makes a high-priority decision,
 * it publishes a structured alert message to the opsmind-alerts Pub/Sub topic.
 *
 * The alert can be consumed by:
 * - Cloud Functions (auto-remediation)
 * - Monitoring dashboards
 * - Notification systems (Slack, PagerDuty via subscriptions)
 * - Any system subscribed to the topic
 *
 * Authentication: uses Application Default Credentials (ADC) — same as Vertex AI.
 * No additional credentials needed.
 *
 * Use when:
 * - A critical anomaly is detected (severity: critical or high)
 * - A decision requires immediate external notification
 * - An autonomous investigation finds a severe business risk
 */
export class PublishAlertTool extends BaseTool<PublishAlertInput, PublishAlertOutput> {
  readonly name = "publish_alert";
  readonly description =
    "[ACTION] Publishes an operational alert to Google Cloud Pub/Sub for real-time notification. " +
    "REQUIRED input: { \"severity\": \"critical\"|\"high\"|\"medium\"|\"low\", \"title\": \"<alert title>\", \"description\": \"<what happened>\" }. " +
    "Use this when a critical or high-severity anomaly is confirmed and requires immediate external notification. " +
    "The alert is published to the opsmind-alerts topic and consumed by downstream systems. " +
    "This is a REAL ACTION — it executes in Google Cloud Pub/Sub.";
  readonly category = "system" as const;
  readonly inputSchema = publishAlertInputSchema as any;
  readonly outputSchema = publishAlertOutputSchema;

  protected async run(input: PublishAlertInput): Promise<ToolResult<PublishAlertOutput>> {
    const env = getEnv();
    const projectId = env.GOOGLE_CLOUD_PROJECT_ID;
    const topicId = env.PUBSUB_TOPIC_ID ?? "opsmind-alerts";

    if (!projectId) {
      return toolFailure(
        "PUBSUB_CONFIG_MISSING",
        "GOOGLE_CLOUD_PROJECT_ID is required for Pub/Sub alerts",
        0
      );
    }

    logger.info("Publishing alert to Google Cloud Pub/Sub", {
      severity: input.severity,
      title: input.title,
      topicId,
      projectId,
    });

    const start = Date.now();

    try {
      const { PubSub } = await import("@google-cloud/pubsub");
      const pubsub = new PubSub({ projectId });
      const topic = pubsub.topic(topicId);

      const publishedAt = new Date().toISOString();

      // Structured alert message
      const alertPayload = {
        source: "opsmind-agent",
        severity: input.severity,
        title: input.title,
        description: input.description,
        publishedAt,
        ...(input.affectedMetric !== undefined ? { affectedMetric: input.affectedMetric } : {}),
        ...(input.decisionId !== undefined ? { decisionId: input.decisionId } : {}),
        ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
        recommendedActions: input.recommendedActions,
        metadata: {
          system: "opsmind",
          version: "1.0.0",
          environment: env.NODE_ENV,
        },
      };

      const messageBuffer = Buffer.from(JSON.stringify(alertPayload));

      const messageId = await topic.publishMessage({
        data: messageBuffer,
        attributes: {
          severity: input.severity,
          source: "opsmind-agent",
          ...(input.affectedMetric !== undefined ? { affectedMetric: input.affectedMetric } : {}),
        },
      });

      const durationMs = Date.now() - start;

      logger.info("Alert published successfully", {
        messageId,
        topicId,
        severity: input.severity,
        durationMs,
      });

      return toolSuccess(
        {
          messageId,
          topicId,
          publishedAt,
          severity: input.severity,
          title: input.title,
          executedVia: "google-cloud-pubsub",
        },
        durationMs
      );
    } catch (error) {
      const durationMs = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);

      logger.error("Failed to publish alert to Pub/Sub", error instanceof Error ? error : undefined, {
        topicId,
        severity: input.severity,
      });

      return toolFailure(
        "PUBSUB_PUBLISH_FAILED",
        `Failed to publish alert to Pub/Sub: ${message}`,
        durationMs
      );
    }
  }
}
