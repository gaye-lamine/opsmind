import { z } from "zod";
import { createLogger } from "@opsmind/shared";
import { getEnv } from "@opsmind/config";
import { getGitLabMcpClient } from "@opsmind/mcp-client";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../registry/tool.interface";

const logger = createLogger("CreateGitlabIssueTool");

// ─── Input Schema ─────────────────────────────────────────────────────────────

const createGitlabIssueInputSchema = z.object({
  /**
   * Title of the GitLab issue.
   */
  title: z.string().min(1).max(255),
  /**
   * Detailed description of the issue (Markdown supported).
   * Usually includes the analysis results and recommendations.
   */
  description: z.string().min(1),
  /**
   * GitLab Project ID or full path (e.g. "my-org/my-project").
   * If not provided, uses GITLAB_PROJECT_ID from environment.
   */
  projectId: z.string().optional(),
  /**
   * Optional labels to add to the issue (comma-separated or array).
   */
  labels: z.union([z.string(), z.array(z.string())]).optional(),
  /**
   * Severity to map to labels.
   */
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

type CreateGitlabIssueInput = z.infer<typeof createGitlabIssueInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const createGitlabIssueOutputSchema = z.object({
  issueIid: z.number(),
  webUrl: z.string(),
  projectId: z.string(),
  title: z.string(),
  status: z.literal("created"),
  executedVia: z.literal("gitlab-mcp-server"),
});

type CreateGitlabIssueOutput = z.infer<typeof createGitlabIssueOutputSchema>;

// ─── Tool Implementation ──────────────────────────────────────────────────────

/**
 * CreateGitlabIssueTool — reports operational anomalies to GitLab.
 * 
 * This tool "closes the loop" by transforming a detected anomaly/decision
 * into a trackable engineering item in GitLab.
 * 
 * It uses the official GitLab Duo MCP Server to perform the action.
 * 
 * Use when:
 * - An anomaly is confirmed and requires developer intervention.
 * - A strategic decision needs a formal tracking record.
 * - Auto-remediation failed and human help is needed.
 */
export class CreateGitlabIssueTool extends BaseTool<CreateGitlabIssueInput, CreateGitlabIssueOutput> {
  readonly name = "create_gitlab_issue";
  readonly description = 
    "[ACTION] Reports an operational anomaly or decision to GitLab as a new issue. " +
    "REQUIRED input: { \"title\": \"<issue title>\", \"description\": \"<issue body>\" }. " +
    "Use this to 'close the loop' and notify the engineering team about a problem or decision. " +
    "The issue will be created in the configured GitLab project. " +
    "This is a REAL ACTION — it creates an actual issue in GitLab.";
  readonly category = "business" as const;
  readonly inputSchema = createGitlabIssueInputSchema as any;
  readonly outputSchema = createGitlabIssueOutputSchema;

  protected async run(input: CreateGitlabIssueInput): Promise<ToolResult<CreateGitlabIssueOutput>> {
    const env = getEnv();
    const projectId = input.projectId || env.GITLAB_PROJECT_ID;

    if (!projectId) {
      return toolFailure(
        "GITLAB_CONFIG_MISSING",
        "GitLab Project ID is required. Provide it in the tool call or via GITLAB_PROJECT_ID environment variable.",
        0
      );
    }

    const start = Date.now();

    try {
      const gitlabMcp = getGitLabMcpClient();
      
      // Map labels
      const labels = Array.isArray(input.labels) 
        ? input.labels 
        : input.labels 
          ? [input.labels] 
          : [];
      
      labels.push(`severity:${input.severity}`);
      labels.push("opsmind-automated");

      logger.info("Creating GitLab issue via MCP", {
        projectId,
        title: input.title,
        severity: input.severity,
      });

      // Execute the 'create_issue' tool on the GitLab MCP Server
      const result = await gitlabMcp.execute("create_issue", {
        id: projectId,
        title: input.title,
        description: input.description,
        labels: labels.join(","),
      });

      const durationMs = Date.now() - start;

      if (!result.success) {
        return toolFailure(
          "GITLAB_MCP_ERROR",
          `GitLab MCP failed to create issue: ${result.error?.message}`,
          durationMs
        );
      }

      // Extract data from MCP result
      // The GitLab MCP server returns the issue object
      const issueData = result.data as any;

      return toolSuccess(
        {
          issueIid: issueData.iid,
          webUrl: issueData.web_url || `https://gitlab.com/${projectId}/-/issues/${issueData.iid}`,
          projectId: String(projectId),
          title: input.title,
          status: "created",
          executedVia: "gitlab-mcp-server",
        },
        durationMs
      );
    } catch (error) {
      const durationMs = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);

      logger.error("Failed to execute CreateGitlabIssueTool", error instanceof Error ? error : undefined, {
        projectId,
      });

      return toolFailure(
        "GITLAB_TOOL_ERROR",
        `Failed to create GitLab issue: ${message}`,
        durationMs
      );
    }
  }
}
