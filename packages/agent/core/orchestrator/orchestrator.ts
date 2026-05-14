import { createLogger, AgentError, ERROR_CODES, withTimeout } from "@opsmind/shared";
import { getAgentConfig, REASONING_STEPS } from "@opsmind/config";
import {
  GoalDecomposer,
  PlannerEngine,
  DecisionSynthesizer,
  ReflectionLoop,
  generateEmbedding,
} from "@opsmind/ai";
import {
  ContextAssembler,
  MemoryWriter,
  SessionRepository,
} from "@opsmind/memory";
import { getToolRegistry } from "@opsmind/tools";
import { AgentStateManager } from "../state-manager/agent-state.manager";
import { ExecutionLoop } from "../execution-loop/execution-loop";
import { type AgentRunResult, type PipelineStepEvent } from "../../interfaces/agent.interfaces";
import { type SessionDocument } from "@opsmind/memory";

const logger = createLogger("Orchestrator");

/**
 * Orchestrator — the central coordinator of the OpsMind reasoning pipeline.
 *
 * Implements the full 8-step pipeline:
 *   Context Assembly → Goal Decomposition → Planning → Tool Selection
 *   → Execution → Decision Synthesis → Reflection → Memory Persistence
 *
 * Two entry points:
 * - run()              → generates its own sessionId (synchronous API path)
 * - runWithSessionId() → uses a pre-generated sessionId (async SSE path)
 */

export type EventEmitter = (event: PipelineStepEvent) => void;

export class Orchestrator {
  private readonly goalDecomposer = new GoalDecomposer();
  private readonly plannerEngine = new PlannerEngine();
  private readonly decisionSynthesizer = new DecisionSynthesizer();
  private readonly reflectionLoop = new ReflectionLoop();
  private readonly contextAssembler = new ContextAssembler();
  private readonly memoryWriter = new MemoryWriter();
  private readonly executionLoop = new ExecutionLoop();
  private readonly sessionRepo = new SessionRepository();

  /**
   * Standard entry point — generates its own sessionId.
   * Used by the synchronous API path (AgentRuntime.runSession).
   */
  async run(
    goal: string,
    context: { domain?: string; timeframe?: string; metrics?: string[] } | undefined,
    onEvent?: EventEmitter
  ): Promise<AgentRunResult> {
    const stateManager = new AgentStateManager(goal, context ?? {});
    return this.execute(goal, context, stateManager, onEvent);
  }

  /**
   * Async entry point — uses a pre-generated sessionId.
   * Used by AgentRuntime.startSessionAsync() so the sessionId is known
   * before the pipeline starts and can be returned to the client immediately.
   */
  async runWithSessionId(
    sessionId: string,
    goal: string,
    context: { domain?: string; timeframe?: string; metrics?: string[] } | undefined,
    onEvent?: EventEmitter
  ): Promise<AgentRunResult> {
    const stateManager = new AgentStateManager(goal, context ?? {}, sessionId);
    return this.execute(goal, context, stateManager, onEvent);
  }

  // ─── Core execution ──────────────────────────────────────────────────────────

  private async execute(
    goal: string,
    context: { domain?: string; timeframe?: string; metrics?: string[] } | undefined,
    stateManager: AgentStateManager,
    onEvent?: EventEmitter
  ): Promise<AgentRunResult> {
    const config = getAgentConfig();
    const sessionId = stateManager.sessionId;
    const startTime = Date.now();

    const emit = (event: PipelineStepEvent): void => {
      onEvent?.(event);
    };

    logger.info("Agent run started", { sessionId, goal: goal.slice(0, 100) });

    // Persist session to MongoDB immediately
    await this.createSession(sessionId, goal, context);

    // Mark session as running in MongoDB so polling clients see progress
    await this.sessionRepo.updateSession(sessionId, { status: "running" }).catch(() => {
      // Non-critical — session was just created
    });

    // Register active investigation in operational state
    await this.updateStateInvestigation(sessionId, "add");

    // Set up timeout
    const timeoutHandle = setTimeout(async () => {
      logger.error("Agent session timed out", { sessionId });
      stateManager.markFailed("timeout");
      await this.memoryWriter.recordSessionFailure(sessionId, {
        code: ERROR_CODES.AGENT_TIMEOUT,
        message: `Session timed out after ${config.totalTimeoutMs}ms`,
        step: stateManager.currentState.currentStep,
      });
    }, config.totalTimeoutMs);

    try {
      const result = await this.runPipeline(goal, stateManager, emit, startTime);
      clearTimeout(timeoutHandle);
      await this.updateStateInvestigation(sessionId, "remove");
      return result;
    } catch (error) {
      clearTimeout(timeoutHandle);
      await this.updateStateInvestigation(sessionId, "remove");

      const agentError =
        error instanceof AgentError
          ? error
          : new AgentError(
              error instanceof Error ? error.message : String(error),
              ERROR_CODES.AGENT_REASONING_FAILED
            );

      const durationMs = Date.now() - startTime;

      logger.error("Agent run failed", agentError, { sessionId, durationMs });

      await this.memoryWriter.recordSessionFailure(sessionId, {
        code: agentError.code,
        message: agentError.message,
        step: stateManager.currentState.currentStep,
      });

      emit({
        type: "session_failed",
        error: agentError.message,
        sessionId,
        timestamp: new Date(),
      });

      return {
        success: false,
        sessionId,
        error: {
          code: agentError.code,
          message: agentError.message,
          step: stateManager.currentState.currentStep,
        },
        durationMs,
      };
    }
  }

  // ─── Pipeline ────────────────────────────────────────────────────────────────

  private async runPipeline(
    goal: string,
    stateManager: AgentStateManager,
    emit: EventEmitter,
    startTime: number
  ): Promise<AgentRunResult> {
    const sessionId = stateManager.sessionId;

    // ── Step 1: Context Assembly ─────────────────────────────────────────────
    stateManager.setCurrentStep(REASONING_STEPS.CONTEXT_ASSEMBLY);
    emit({ type: "step_started", step: REASONING_STEPS.CONTEXT_ASSEMBLY, sessionId, timestamp: new Date() });

    const stepStart = Date.now();

    // Generate goal embedding for semantic memory retrieval.
    // Only used when VECTOR_SEARCH_ENABLED=true — runs with a timeout to avoid
    // blocking the pipeline if the embedding API is slow.
    const goalEmbedding = await Promise.race([
      generateEmbedding(goal),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);

    const assembledContext = await withTimeout(
      this.contextAssembler.assembleContext(goal, "business_analysis", goalEmbedding),
      30000,
      "Context assembly timed out"
    );
    stateManager.setMemoryContext(assembledContext.memoryContext);

    const operationalContext = assembledContext.currentStateSnapshot;
    const memoryContextText = this.formatMemoryContext(assembledContext);

    emit({ type: "step_completed", step: REASONING_STEPS.CONTEXT_ASSEMBLY, sessionId, durationMs: Date.now() - stepStart, timestamp: new Date() });
    await this.persistStepLog(
      sessionId,
      REASONING_STEPS.CONTEXT_ASSEMBLY,
      `Context assembled from MongoDB${assembledContext.usedVectorSearch ? " (Vector Search)" : " (temporal)"}`
    );

    // ── Step 2: Goal Decomposition ───────────────────────────────────────────
    stateManager.setCurrentStep(REASONING_STEPS.GOAL_DECOMPOSITION);
    emit({ type: "step_started", step: REASONING_STEPS.GOAL_DECOMPOSITION, sessionId, timestamp: new Date() });

    const decompositionStart = Date.now();
    const decomposedGoal = await withTimeout(
      this.goalDecomposer.decompose(goal, operationalContext, memoryContextText),
      90000,
      "Goal decomposition timed out"
    );
    stateManager.updateGoalFromDecomposition(decomposedGoal);

    // Re-assemble with known category for better relevance
    const refinedContext = await this.contextAssembler.assembleContext(
      goal,
      decomposedGoal.category,
      goalEmbedding
    );
    stateManager.setMemoryContext(refinedContext.memoryContext);
    const refinedMemoryText = this.formatMemoryContext(refinedContext);

    emit({ type: "step_completed", step: REASONING_STEPS.GOAL_DECOMPOSITION, sessionId, durationMs: Date.now() - decompositionStart, timestamp: new Date() });
    await this.persistStepLog(sessionId, REASONING_STEPS.GOAL_DECOMPOSITION,
      `Goal decomposed: ${decomposedGoal.category}, ${decomposedGoal.reasoningSteps.length} steps, priority: ${decomposedGoal.priority}`
    );

    // ── Step 3: Planning ─────────────────────────────────────────────────────
    stateManager.setCurrentStep(REASONING_STEPS.PLANNING);
    emit({ type: "step_started", step: REASONING_STEPS.PLANNING, sessionId, timestamp: new Date() });

    const planningStart = Date.now();
    const registry = getToolRegistry();

    /**
     * Infrastructure tools are managed internally — never exposed to the planner.
     * write_decision → MemoryWriter (step 8)
     * update_memory  → Orchestrator internal
     * action_log     → MemoryWriter internal
     * update_operational_state → Orchestrator automatic actions (post-decision)
     * trigger_followup_investigation → Orchestrator automatic actions (post-decision)
     */
    const INFRASTRUCTURE_TOOLS = new Set([
      "write_decision",
      "update_memory",
      "action_log",
      "update_operational_state",
      "trigger_followup_investigation",
    ]);

    const availableTools = registry
      .getManifests()
      .filter((m) => !INFRASTRUCTURE_TOOLS.has(m.name))
      .map((m) => ({ name: m.name, description: m.description, category: m.category }));

    const executionPlan = await withTimeout(
      this.plannerEngine.plan(
        decomposedGoal,
        availableTools,
        operationalContext,
        refinedMemoryText
      ),
      90000,
      "Planning engine timed out"
    );
    stateManager.setPlanSteps(executionPlan.steps);

    emit({ type: "step_completed", step: REASONING_STEPS.PLANNING, sessionId, durationMs: Date.now() - planningStart, timestamp: new Date() });
    await this.persistStepLog(sessionId, REASONING_STEPS.PLANNING,
      `Execution plan built: ${executionPlan.steps.length} steps — ${executionPlan.planRationale}`
    );

    // ── Step 4 & 5: Tool Selection + Execution ───────────────────────────────
    stateManager.setCurrentStep(REASONING_STEPS.EXECUTION);
    emit({ type: "step_started", step: REASONING_STEPS.EXECUTION, sessionId, timestamp: new Date() });

    const executionStart = Date.now();
    const executionResult = await withTimeout(
      this.executionLoop.execute(executionPlan, stateManager),
      120000,
      "Execution loop timed out"
    );

    // Emit per-tool events
    for (const toolCall of stateManager.currentState.toolCalls) {
      emit({ type: "tool_called", toolName: toolCall.toolName, sessionId, timestamp: new Date() });
      emit({ type: "tool_result", toolName: toolCall.toolName, success: toolCall.status === "success", sessionId, timestamp: new Date() });
    }

    if (executionResult.aborted) {
      throw new AgentError(
        executionResult.abortReason ?? "Execution loop aborted",
        ERROR_CODES.AGENT_REASONING_FAILED,
        { sessionId, abortReason: executionResult.abortReason }
      );
    }

    emit({ type: "step_completed", step: REASONING_STEPS.EXECUTION, sessionId, durationMs: Date.now() - executionStart, timestamp: new Date() });
    await this.persistStepLog(sessionId, REASONING_STEPS.EXECUTION,
      `Executed ${executionResult.completedSteps} steps, ${executionResult.failedSteps} failed`
    );

    // ── Step 6: Decision Synthesis ───────────────────────────────────────────
    stateManager.setCurrentStep(REASONING_STEPS.DECISION_SYNTHESIS);
    emit({ type: "step_started", step: REASONING_STEPS.DECISION_SYNTHESIS, sessionId, timestamp: new Date() });

    const synthesisStart = Date.now();
    const decision = await withTimeout(
      this.decisionSynthesizer.synthesize({
        rawGoal: goal,
        sessionId,
        decomposedGoal,
        toolResults: executionResult.toolResults,
        operationalContext,
        memoryContext: refinedMemoryText,
        toolsUsed: stateManager.toolsUsed,
        memoryReferences: refinedContext.historicalDecisionSummaries.map((d) => d.id),
        reasoningStepsSummary: stateManager.getCompletedStepsSummary(),
        totalDurationMs: Date.now() - startTime,
      }),
      120000,
      "Decision synthesis timed out"
    );

    emit({ type: "decision_generated", decisionId: decision.id, sessionId, timestamp: new Date() });
    emit({ type: "step_completed", step: REASONING_STEPS.DECISION_SYNTHESIS, sessionId, durationMs: Date.now() - synthesisStart, timestamp: new Date() });
    await this.persistStepLog(sessionId, REASONING_STEPS.DECISION_SYNTHESIS,
      `Decision synthesized: ${decision.findings.length} findings, ${decision.recommendations.length} recommendations, confidence: ${decision.confidenceScore.toFixed(2)}`
    );

    // ── Step 7: Reflection (MANDATORY — §2.4) ────────────────────────────────
    stateManager.setCurrentStep(REASONING_STEPS.REFLECTION);
    emit({ type: "step_started", step: REASONING_STEPS.REFLECTION, sessionId, timestamp: new Date() });

    const reflectionStart = Date.now();
    const synthesisOutput = {
      summary: decision.summary,
      reasoning: decision.reasoning,
      findings: decision.findings,
      recommendations: decision.recommendations,
      confidenceScore: decision.confidenceScore,
      confidenceRationale: `Confidence based on ${executionResult.completedSteps} successful tool executions`,
      rootCauseAnalysis: decision.reasoning,
      predictedImpactIfUnaddressed: "See findings for impact assessment",
    };

    const reflectionResult = await withTimeout(
      this.reflectionLoop.reflect(
        decision,
        synthesisOutput,
        executionResult.toolResults,
        refinedMemoryText
      ),
      180000,
      "Reflection loop timed out"
    );

    emit({
      type: "reflection_completed",
      assessment: reflectionResult.reflection.overallAssessment,
      confidenceDelta: reflectionResult.confidenceDelta,
      sessionId,
      timestamp: new Date(),
    });
    emit({ type: "step_completed", step: REASONING_STEPS.REFLECTION, sessionId, durationMs: Date.now() - reflectionStart, timestamp: new Date() });
    await this.persistStepLog(sessionId, REASONING_STEPS.REFLECTION,
      `Reflection: ${reflectionResult.reflection.overallAssessment}, quality: ${reflectionResult.reflection.reasoningQuality}, confidence delta: ${reflectionResult.confidenceDelta.toFixed(3)}`
    );

    // ── Step 8: Memory Persistence ───────────────────────────────────────────
    stateManager.setCurrentStep(REASONING_STEPS.MEMORY_PERSISTENCE);
    emit({ type: "step_started", step: REASONING_STEPS.MEMORY_PERSISTENCE, sessionId, timestamp: new Date() });

    const persistStart = Date.now();
    const finalDecision = reflectionResult.updatedDecision;

    // Persist the decision immediately — do NOT wait for embedding generation
    await this.memoryWriter.persistDecision(finalDecision);

    // Generate and store embedding asynchronously after persist — non-blocking.
    const embeddingText = `${finalDecision.goal} ${finalDecision.summary}`;
    generateEmbedding(embeddingText)
      .then((embedding) => {
        if (embedding !== null) {
          return this.memoryWriter.storeEmbedding(finalDecision.id, embedding);
        }
        return Promise.resolve();
      })
      .catch((err: unknown) => {
        logger.warn("Background embedding generation failed — Vector Search will use fallback", {
          decisionId: finalDecision.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    // ── Automatic Action Execution ────────────────────────────────────────────
    // Execute real actions based on the decision findings — non-blocking.
    // These run after memory persistence so the decision is already stored.
    this.executeAutomaticActions(finalDecision, sessionId, emit).catch((err: unknown) => {
      logger.warn("Automatic action execution failed — non-critical", {
        decisionId: finalDecision.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    const totalDurationMs = Date.now() - startTime;
    await this.memoryWriter.finalizeSession(sessionId, finalDecision.id, totalDurationMs);
    await this.updateStateWithDecision(finalDecision.id);

    stateManager.markComplete();

    emit({ type: "step_completed", step: REASONING_STEPS.MEMORY_PERSISTENCE, sessionId, durationMs: Date.now() - persistStart, timestamp: new Date() });
    emit({ type: "session_completed", decisionId: finalDecision.id, sessionId, durationMs: totalDurationMs, timestamp: new Date() });

    logger.info("Agent run completed", {
      sessionId,
      decisionId: finalDecision.id,
      totalDurationMs,
      confidenceScore: finalDecision.confidenceScore,
      findingsCount: finalDecision.findings.length,
      recommendationsCount: finalDecision.recommendations.length,
    });

    return {
      success: true,
      sessionId,
      decision: finalDecision,
      durationMs: totalDurationMs,
      stepCount: stateManager.currentState.completedSteps.length,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private formatMemoryContext(context: import("@opsmind/memory").AssembledContext): string {
    const parts: string[] = [];

    if (context.currentStateSnapshot !== "No operational state available") {
      parts.push(`## Current Operational State\n${context.currentStateSnapshot}`);
    }

    if (context.historicalDecisionSummaries.length > 0) {
      const retrievalMode = context.usedVectorSearch
        ? "semantic similarity"
        : "recent history";

      parts.push(
        `## Historical Decisions (${context.historicalDecisionSummaries.length} — retrieved by ${retrievalMode})\n` +
          context.historicalDecisionSummaries
            .map((d) => {
              const score =
                d.similarityScore !== undefined
                  ? ` [similarity: ${d.similarityScore.toFixed(2)}]`
                  : "";
              return `- [${d.category}]${score} ${d.goal}: ${d.summary} (confidence: ${d.confidenceScore.toFixed(2)})`;
            })
            .join("\n")
      );
    }

    if (context.relevantAnomalyHistory.length > 0) {
      parts.push(
        `## Known Anomalies\n` +
          context.relevantAnomalyHistory
            .map((a) => `- [${a.severity}] ${a.metric}: ${a.description}`)
            .join("\n")
      );
    }

    if (context.successfulActionPatterns.length > 0) {
      parts.push(
        `## Successful Action Patterns\n` +
          context.successfulActionPatterns
            .filter((p) => p.wasSuccessful)
            .map((p) => `- ${p.title}: ${p.estimatedImpact}`)
            .join("\n")
      );
    }

    return parts.length > 0 ? parts.join("\n\n") : "No historical context available.";
  }

  private async createSession(
    sessionId: string,
    goal: string,
    context: { domain?: string; timeframe?: string; metrics?: string[] } | undefined
  ): Promise<void> {
    const doc: SessionDocument = {
      _id: sessionId,
      goal,
      category: "business_analysis",
      status: "initializing",
      currentStep: "initializing",
      stepCount: 0,
      completedSteps: [],
      toolCalls: [],
      memoryReferences: [],
      ...(context !== undefined ? { context } : {}),
      startedAt: new Date(),
    };
    await this.sessionRepo.insertOne(doc);
  }

  private async persistStepLog(sessionId: string, step: string, message: string): Promise<void> {
    await this.memoryWriter.writeLog({ sessionId, level: "info", step, message });
  }

  private async updateStateInvestigation(sessionId: string, action: "add" | "remove"): Promise<void> {
    try {
      const registry = getToolRegistry();
      if (!registry.has("update_memory")) return;
      await registry.execute("update_memory", {
        operation: "update_state",
        sessionId,
        updates:
          action === "add"
            ? { addInvestigationId: sessionId }
            : { removeInvestigationId: sessionId },
      });
    } catch {
      logger.warn("Failed to update investigation state", { sessionId, action });
    }
  }

  private async updateStateWithDecision(decisionId: string): Promise<void> {
    try {
      const registry = getToolRegistry();
      if (!registry.has("update_memory")) return;
      await registry.execute("update_memory", {
        operation: "update_state",
        sessionId: "system",
        updates: { lastDecisionId: decisionId },
      });
    } catch {
      logger.warn("Failed to update state with decision", { decisionId });
    }
  }

  /**
   * Executes automatic real actions based on the finalized decision.
   *
   * This is the "executes actions automatically through real systems" capability.
   * Called non-blocking after memory persistence — failures don't affect the decision.
   *
   * Actions triggered:
   * 1. publish_alert → Google Cloud Pub/Sub (for critical/high findings)
   * 2. update_operational_state → MongoDB Atlas (mark anomalies as investigating)
   */
  private async executeAutomaticActions(
    decision: import("@opsmind/shared").Decision,
    sessionId: string,
    emit: EventEmitter
  ): Promise<void> {
    const registry = getToolRegistry();

    const criticalFindings = decision.findings.filter(
      (f) => f.severity === "critical" || f.severity === "warning"
    );

    if (criticalFindings.length === 0) {
      logger.debug("No critical findings — skipping automatic actions", {
        decisionId: decision.id,
      });
      return;
    }

    logger.info("Executing automatic actions for decision", {
      decisionId: decision.id,
      criticalFindings: criticalFindings.length,
      category: decision.category,
    });

    // ── Action 1: Publish alert to Google Cloud Pub/Sub ──────────────────────
    if (registry.has("publish_alert")) {
      const topFinding = criticalFindings[0];
      if (topFinding) {
        const alertSeverity = topFinding.severity === "critical" ? "critical" : "high";

        emit({ type: "tool_called", toolName: "publish_alert", sessionId, timestamp: new Date() });

        const alertResult = await registry.execute("publish_alert", {
          severity: alertSeverity,
          title: topFinding.title,
          description: topFinding.description,
          decisionId: decision.id,
          sessionId,
          recommendedActions: decision.recommendations
            .slice(0, 3)
            .map((r) => `[${r.priority}] ${r.title}`),
        });

        emit({
          type: "tool_result",
          toolName: "publish_alert",
          success: alertResult.success,
          sessionId,
          timestamp: new Date(),
        });

        if (alertResult.success) {
          const messageId = (alertResult.data as Record<string, unknown>)["messageId"] as string;
          logger.info("✅ Alert published to Google Cloud Pub/Sub", {
            decisionId: decision.id,
            severity: alertSeverity,
            messageId,
          });

          // Log the executed action for UI visibility
          await this.memoryWriter.writeLog({
            sessionId,
            level: "info",
            step: "autonomous_action",
            message: "Alert published to Google Cloud Pub/Sub",
            data: {
              actionType: "publish_alert",
              system: "google-cloud-pubsub",
              status: "success",
              severity: alertSeverity,
              title: topFinding.title,
              description: topFinding.description,
              messageId,
              decisionId: decision.id,
              sessionId,
              recommendedActions: decision.recommendations
                .slice(0, 3)
                .map((r) => `[${r.priority}] ${r.title}`),
              executedAt: new Date().toISOString(),
            },
            decisionId: decision.id,
          });
        } else {
          logger.warn("Failed to publish alert", {
            decisionId: decision.id,
            error: alertResult.error.message,
          });
        }
      }
    }

    // ── Action 2: Mark anomalies as investigating in MongoDB Atlas ────────────
    if (registry.has("update_operational_state")) {
      const stateResult = await registry.execute("read_operational_state", {
        mode: "current",
      });

      if (stateResult.success) {
        const snapshots = (stateResult.data as Record<string, unknown>)["snapshots"] as Array<{
          anomalies: Array<{ id: string; metric: string; status: string; severity: string }>;
        }>;

        const currentSnapshot = snapshots?.[0];
        if (currentSnapshot?.anomalies) {
          const detectableAnomalies = currentSnapshot.anomalies.filter(
            (a) => a.status === "detected" && (a.severity === "critical" || a.severity === "high")
          );

          for (const anomaly of detectableAnomalies.slice(0, 2)) {
            emit({ type: "tool_called", toolName: "update_operational_state", sessionId, timestamp: new Date() });

            const updateResult = await registry.execute("update_operational_state", {
              operation: "mark_investigating",
              anomalyId: anomaly.id,
              sessionId,
              decisionId: decision.id,
            });

            emit({
              type: "tool_result",
              toolName: "update_operational_state",
              success: updateResult.success,
              sessionId,
              timestamp: new Date(),
            });

            if (updateResult.success) {
              logger.info("✅ Anomaly marked as investigating in MongoDB Atlas", {
                anomalyId: anomaly.id,
                metric: anomaly.metric,
                decisionId: decision.id,
              });

              // Log the executed action for UI visibility
              await this.memoryWriter.writeLog({
                sessionId,
                level: "info",
                step: "autonomous_action",
                message: `Anomaly marked as investigating in MongoDB Atlas: ${anomaly.metric}`,
                data: {
                  actionType: "update_operational_state",
                  system: "mongodb-atlas",
                  status: "success",
                  anomalyId: anomaly.id,
                  metric: anomaly.metric,
                  operation: "mark_investigating",
                  decisionId: decision.id,
                  executedAt: new Date().toISOString(),
                },
                decisionId: decision.id,
              });
            }
          }
        }
      }
    }
  }
}
