import { createLogger, ERROR_CODES, MemoryError } from "@opsmind/shared";
import { type DecisionQueryDto } from "@opsmind/shared";
import { type Decision } from "@opsmind/shared";
import { DecisionRepository, ExecutionLogRepository } from "@opsmind/memory";
import { type DecisionDocument } from "@opsmind/memory";
import { generateEmbedding } from "@opsmind/ai";

const logger = createLogger("DecisionService");

/**
 * Decision Service — retrieves decisions from MongoDB for the API layer.
 *
 * Rule §3.2: apps/api NEVER queries MongoDB directly.
 * This service uses the DecisionRepository from @opsmind/memory.
 *
 * Note: The repository is the only allowed MongoDB access point.
 */
export class DecisionService {
  private readonly decisionRepo = new DecisionRepository();
  private readonly logRepo = new ExecutionLogRepository();

  async listDecisions(query: DecisionQueryDto) {
    logger.debug("Listing decisions", { query });
    return this.decisionRepo.queryPaginated(query);
  }

  async searchDecisions(query: string, limit: number = 10) {
    logger.info("Performing hybrid search", { query, limit });
    
    // Generate embedding for the search query
    const embedding = await generateEmbedding(query);
    
    // Perform hybrid search in the repository
    const results = await this.decisionRepo.searchHybrid(query, embedding, limit);
    
    return {
      items: results.map(r => ({
        ...mapDocumentToDecision(r),
        searchScore: r.searchScore,
        searchType: r.searchType
      })),
      total: results.length
    };
  }

  async getDecisionById(id: string): Promise<Decision> {
    const doc = await this.decisionRepo.findById(id);
    if (!doc) {
      throw new MemoryError(
        `Decision ${id} not found`,
        ERROR_CODES.DECISION_NOT_FOUND,
        { decisionId: id }
      );
    }
    return mapDocumentToDecision(doc);
  }

  /**
   * Returns the real actions executed by the agent for a decision.
   * Reads execution_logs where step = "autonomous_action".
   */
  async getExecutedActions(decisionId: string): Promise<Array<{
    actionType: string;
    system: string;
    status: string;
    message: string;
    details: Record<string, unknown>;
    executedAt: string;
  }>> {
    const logs = await this.logRepo.findByDecisionId(decisionId);
    return logs
      .filter((log) => log.step === "autonomous_action" && log.data !== undefined)
      .map((log) => ({
        actionType: String(log.data?.["actionType"] ?? "unknown"),
        system: String(log.data?.["system"] ?? "unknown"),
        status: String(log.data?.["status"] ?? "unknown"),
        message: log.message,
        details: log.data ?? {},
        executedAt: String(log.data?.["executedAt"] ?? log.timestamp.toISOString()),
      }));
  }
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapDocumentToDecision(doc: DecisionDocument): Decision {
  return {
    id: doc._id,
    sessionId: doc.sessionId,
    goal: doc.goal,
    category: doc.category,
    status: doc.status,
    summary: doc.summary,
    reasoning: doc.reasoning,
    findings: doc.findings.map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      severity: f.severity,
      evidence: f.evidence,
      ...(f.relatedMetrics !== undefined ? { relatedMetrics: f.relatedMetrics } : {}),
    })),
    recommendations: doc.recommendations.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      rationale: r.rationale,
      priority: r.priority,
      status: r.status,
      estimatedImpact: r.estimatedImpact,
      timeframe: r.timeframe,
      ...(r.risks !== undefined ? { risks: r.risks } : {}),
    })),
    ...(doc.reflection !== undefined ? { reflection: doc.reflection } : {}),
    confidenceScore: doc.confidenceScore,
    confidenceLevel: doc.confidenceLevel,
    reasoningTrace: {
      steps: doc.reasoningTrace.steps,
      totalDurationMs: doc.reasoningTrace.totalDurationMs,
      modelUsed: doc.reasoningTrace.modelUsed,
      ...(doc.reasoningTrace.promptTokens !== undefined
        ? { promptTokens: doc.reasoningTrace.promptTokens }
        : {}),
      ...(doc.reasoningTrace.completionTokens !== undefined
        ? { completionTokens: doc.reasoningTrace.completionTokens }
        : {}),
    },
    toolsUsed: doc.toolsUsed,
    memoryReferences: doc.memoryReferences,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
