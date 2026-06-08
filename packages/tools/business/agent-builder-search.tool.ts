import { z } from "zod";
import { createLogger } from "@opsmind/shared";
import { getEnv } from "@opsmind/config";
import {
  BaseTool,
  toolSuccess,
  toolFailure,
  type ToolResult,
} from "../registry/tool.interface";

const logger = createLogger("AgentBuilderSearchTool");

// ─── Input Schema ─────────────────────────────────────────────────────────────

const agentBuilderSearchInputSchema = z.object({
  /**
   * The search query to find in company runbooks or operational documentation.
   */
  query: z.string().min(1),
  /**
   * Maximum number of results to return.
   */
  limit: z.number().int().positive().default(3).transform((v) => Math.min(v, 10)),
});

type AgentBuilderSearchInput = z.infer<typeof agentBuilderSearchInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const searchResultSchema = z.object({
  title: z.string(),
  snippet: z.string(),
  link: z.string().optional(),
});

const agentBuilderSearchOutputSchema = z.object({
  results: z.array(searchResultSchema),
  totalResults: z.number(),
  engineId: z.string(),
  executedVia: z.literal("google-cloud-agent-builder"),
});

type AgentBuilderSearchOutput = z.infer<typeof agentBuilderSearchOutputSchema>;

// ─── Tool Implementation ──────────────────────────────────────────────────────

/**
 * AgentBuilderSearchTool — queries Google Cloud Agent Builder (Discovery Engine)
 * for company runbooks, troubleshooting guides, and operational documentation.
 *
 * This tool is utilized during the Planning and Execution steps when the agent
 * needs context on how to troubleshoot a specific metric anomaly or execute a remediation playbook.
 */
export class AgentBuilderSearchTool extends BaseTool<
  AgentBuilderSearchInput,
  AgentBuilderSearchOutput
> {
  readonly name = "search_agent_builder";
  readonly description =
    "Queries Google Cloud Agent Builder (Discovery Engine) for operational runbooks and guidelines. " +
    "REQUIRED input: { \"query\": \"<search query>\" }. " +
    "Use this when you need documentation on how to resolve anomalies or configure integrations.";
  readonly category = "business" as const;
  readonly inputSchema = agentBuilderSearchInputSchema;
  readonly outputSchema = agentBuilderSearchOutputSchema;

  protected async run(
    input: AgentBuilderSearchInput
  ): Promise<ToolResult<AgentBuilderSearchOutput>> {
    const env = getEnv();
    const projectId = env.AGENT_BUILDER_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT_ID;
    const location = env.AGENT_BUILDER_LOCATION || "global";
    const collection = env.AGENT_BUILDER_COLLECTION || "default_collection";
    const engineId = env.AGENT_BUILDER_ENGINE_ID || "opsmind-runbooks";
    const servingConfig = env.AGENT_BUILDER_SERVING_CONFIG || "default_search";

    if (!projectId) {
      return toolFailure(
        "AGENT_BUILDER_CONFIG_MISSING",
        "AGENT_BUILDER_PROJECT_ID or GOOGLE_CLOUD_PROJECT_ID is not configured in the environment variables.",
        0
      );
    }

    if (!env.AGENT_BUILDER_ENGINE_ID) {
      return toolFailure(
        "AGENT_BUILDER_ENGINE_MISSING",
        "AGENT_BUILDER_ENGINE_ID is not configured in the environment variables.",
        0
      );
    }

    const start = Date.now();

    try {
      logger.info("Executing Agent Builder search", {
        projectId,
        location,
        collection,
        engineId,
        query: input.query,
      });

      // 1. Dynamic import of the Google Cloud Discovery Engine client library
      const { SearchServiceClient } = await import("@google-cloud/discoveryengine");

      // 2. Instantiate Search Client
      const client = new SearchServiceClient();

      // 3. Format Serving Config path
      const servingConfigPath = client.projectLocationCollectionEngineServingConfigPath(
        projectId,
        location,
        collection,
        engineId,
        servingConfig
      );

      // 4. Execute Search
      const request = {
        servingConfig: servingConfigPath,
        query: input.query,
        pageSize: input.limit,
      };

      const [response] = await client.search(request);
      const durationMs = Date.now() - start;

      const results = (response.results || []).map((r: any) => {
        const doc = r.document || {};
        const derivedStructData = doc.derivedStructData || {};
        const snippets = derivedStructData.snippets || [];
        
        return {
          title: derivedStructData.title || doc.name || "Untitled Runbook",
          snippet: snippets.length > 0 ? snippets[0].snippet : "No snippet available",
          link: derivedStructData.link || undefined,
        };
      });

      logger.info("Agent Builder search completed successfully", {
        resultsCount: results.length,
        durationMs,
      });

      return toolSuccess(
        {
          results,
          totalResults: results.length,
          engineId,
          executedVia: "google-cloud-agent-builder",
        },
        durationMs
      );
    } catch (error) {
      const durationMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error("Agent Builder search failed", error instanceof Error ? error : undefined, {
        projectId,
        engineId,
      });

      return toolFailure(
        "AGENT_BUILDER_API_ERROR",
        `Google Cloud Agent Builder API request failed: ${errorMessage}`,
        durationMs
      );
    }
  }
}
