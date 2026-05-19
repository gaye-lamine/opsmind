import { createLogger, ERROR_CODES, MemoryError, generateId } from "@opsmind/shared";
import { PlaybookRepository, DecisionRepository } from "@opsmind/memory";
import { type Playbook } from "@opsmind/shared";
import { getGeminiClient } from "@opsmind/ai";
import { z } from "zod";

const logger = createLogger("PlaybookService");

const playbookLlmOutputSchema = z.object({
  title: z.string(),
  description: z.string(),
  steps: z.array(z.object({
    stepNumber: z.number(),
    title: z.string(),
    description: z.string(),
    autoRemediationAvailable: z.boolean(),
    actionType: z.string().optional(),
    system: z.string().optional(),
    details: z.record(z.any()).optional()
  }))
});

export class PlaybookService {
  private readonly playbookRepo = new PlaybookRepository();
  private readonly decisionRepo = new DecisionRepository();

  async getOrCreatePlaybook(decisionId: string): Promise<Playbook> {
    logger.info("Retrieving or generating playbook", { decisionId });
    
    // Check database
    const existing = await this.playbookRepo.findByDecisionId(decisionId);
    if (existing) {
      return {
        id: existing._id,
        decisionId: existing.decisionId,
        title: existing.title,
        description: existing.description,
        status: existing.status,
        steps: existing.steps.map(s => ({
          id: s.id,
          stepNumber: s.stepNumber,
          title: s.title,
          description: s.description,
          status: s.status,
          autoRemediationAvailable: s.autoRemediationAvailable,
          actionType: s.actionType,
          system: s.system,
          details: s.details
        })),
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      };
    }

    // Generate via Vector RAG
    const decision = await this.decisionRepo.findById(decisionId);
    if (!decision) {
      throw new MemoryError(
        `Decision ${decisionId} not found to generate playbook`,
        ERROR_CODES.DECISION_NOT_FOUND
      );
    }

    // Find similar historical memories using Vector Search
    let similarDecisions: any[] = [];
    if (decision.embedding && decision.embedding.length > 0) {
      similarDecisions = await this.decisionRepo.findSimilarToEmbedding(
        decision.embedding,
        3,
        decisionId
      );
    }

    // Build the Prompt for Gemini
    const similarContext = similarDecisions.length > 0
      ? similarDecisions.map((d, index) => `
Incident Precedent #${index + 1}:
Goal: ${d.goal}
Summary: ${d.summary}
Findings: ${d.findings?.map((f: any) => `- ${f.title}: ${f.description}`).join("\n")}
Recommendations: ${d.recommendations?.map((r: any) => `- [${r.priority}] ${r.title}: ${r.description}`).join("\n")}
Resolution/Reasoning: ${d.reasoning}
`).join("\n")
      : "No previous similar incidents found in MongoDB memories.";

    const promptText = `You are OpsMind, an autonomous operational intelligence agent.
Your task is to generate a detailed, structured, step-by-step remediation playbook to resolve the current system anomaly.

Current Anomaly context:
Goal: ${decision.goal}
Summary: ${decision.summary}
Findings:
${decision.findings?.map((f: any) => `- ${f.title} (${f.severity}): ${f.description}`).join("\n")}

Recommendations:
${decision.recommendations?.map((r: any) => `- [${r.priority}] ${r.title}: ${r.description}`).join("\n")}

Please review the following historical incidents that were successfully resolved in the past. Use them to synthesize a practical playbook:
${similarContext}

You MUST output a valid JSON object matching this schema. All keys are REQUIRED:
{
  "title": "A concise title for the remediation playbook",
  "description": "A high-level summary of the playbook purpose",
  "steps": [
    {
      "stepNumber": 1,
      "title": "A brief actionable title for this step",
      "description": "Detailed explanation of what needs to be done in this step",
      "autoRemediationAvailable": true,
      "actionType": "gitlab_issue_create",
      "system": "gitlab",
      "details": {
        "title": "GitLab Issue Title",
        "description": "GitLab Issue Description"
      }
    },
    {
      "stepNumber": 2,
      "title": "A manual check step",
      "description": "Verify logs or monitor metrics for stability",
      "autoRemediationAvailable": false
    }
  ]
}

Rule:
- For steps that require automated system actions, set autoRemediationAvailable to true and fill in actionType, system, and details.
- For steps that require human operator review, set autoRemediationAvailable to false.
- Ensure that the JSON is fully well-formed and does not contain any comments or trailing commas.`;

    logger.info("Invoking Gemini to synthesize playbook using Vector RAG context");
    const gemini = getGeminiClient();
    const result = await gemini.generateStructured(
      {
        userPrompt: promptText,
        systemPrompt: "You are a professional Site Reliability Engineer (SRE). Output playbooks only in strict JSON.",
        temperature: 0.2
      },
      playbookLlmOutputSchema
    );

    const generated = result.data;
    
    const playbookDoc = {
      _id: decisionId,
      decisionId,
      title: generated.title || `Remediation Playbook for: ${decision.goal}`,
      description: generated.description || `AI-Generated RAG playbook synthesized from past incident memory.`,
      status: "active" as const,
      steps: generated.steps.map((s, index) => ({
        id: `step_${index + 1}_${generateId().slice(0, 6)}`,
        stepNumber: s.stepNumber || index + 1,
        title: s.title,
        description: s.description,
        status: "pending" as const,
        autoRemediationAvailable: s.autoRemediationAvailable ?? false,
        actionType: s.actionType,
        system: s.system,
        details: s.details
      })),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.playbookRepo.savePlaybook(playbookDoc);
    logger.info("Playbook created and saved successfully in MongoDB", { decisionId });

    return {
      id: playbookDoc._id,
      decisionId: playbookDoc.decisionId,
      title: playbookDoc.title,
      description: playbookDoc.description,
      status: playbookDoc.status,
      steps: playbookDoc.steps.map(s => ({
        id: s.id,
        stepNumber: s.stepNumber,
        title: s.title,
        description: s.description,
        status: s.status,
        autoRemediationAvailable: s.autoRemediationAvailable,
        actionType: s.actionType,
        system: s.system,
        details: s.details
      })),
      createdAt: playbookDoc.createdAt.toISOString(),
      updatedAt: playbookDoc.updatedAt.toISOString(),
    };
  }

  async executePlaybookStep(decisionId: string, stepId: string): Promise<Playbook> {
    logger.info("Executing automated step", { decisionId, stepId });
    const playbook = await this.playbookRepo.findByDecisionId(decisionId);
    if (!playbook) {
      throw new MemoryError(`Playbook not found for decision ${decisionId}`, ERROR_CODES.DECISION_NOT_FOUND);
    }

    const stepIndex = playbook.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) {
      throw new MemoryError(`Step ${stepId} not found in playbook`, ERROR_CODES.DECISION_NOT_FOUND);
    }

    const step = playbook.steps[stepIndex];
    if (!step.autoRemediationAvailable) {
      throw new MemoryError(`Step ${stepId} is not auto-remediable`, ERROR_CODES.ACTION_NOT_FOUND);
    }

    // Execute (Simulated execution with detailed logging)
    logger.info(`Running auto-remediation: ${step.title}`, { actionType: step.actionType, details: step.details });
    
    // Set step status to completed
    playbook.steps[stepIndex].status = "completed";
    playbook.updatedAt = new Date();

    // Check if all steps are now completed
    const allCompleted = playbook.steps.every(s => s.status === "completed" || s.status === "skipped");
    if (allCompleted) {
      playbook.status = "completed";
    }

    await this.playbookRepo.updatePlaybook(decisionId, {
      steps: playbook.steps,
      status: playbook.status,
      updatedAt: playbook.updatedAt
    });

    return {
      id: playbook._id,
      decisionId: playbook.decisionId,
      title: playbook.title,
      description: playbook.description,
      status: playbook.status,
      steps: playbook.steps.map(s => ({
        id: s.id,
        stepNumber: s.stepNumber,
        title: s.title,
        description: s.description,
        status: s.status,
        autoRemediationAvailable: s.autoRemediationAvailable,
        actionType: s.actionType,
        system: s.system,
        details: s.details
      })),
      createdAt: playbook.createdAt.toISOString(),
      updatedAt: playbook.updatedAt.toISOString()
    };
  }

  async togglePlaybookStep(
    decisionId: string,
    stepId: string,
    status: "pending" | "completed" | "skipped"
  ): Promise<Playbook> {
    logger.info("Toggling step status manually", { decisionId, stepId, status });
    const playbook = await this.playbookRepo.findByDecisionId(decisionId);
    if (!playbook) {
      throw new MemoryError(`Playbook not found for decision ${decisionId}`, ERROR_CODES.DECISION_NOT_FOUND);
    }

    const stepIndex = playbook.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) {
      throw new MemoryError(`Step ${stepId} not found in playbook`, ERROR_CODES.DECISION_NOT_FOUND);
    }

    playbook.steps[stepIndex].status = status;
    playbook.updatedAt = new Date();

    // Check overall status
    const allCompleted = playbook.steps.every(s => s.status === "completed" || s.status === "skipped");
    if (allCompleted) {
      playbook.status = "completed";
    } else {
      playbook.status = "active";
    }

    await this.playbookRepo.updatePlaybook(decisionId, {
      steps: playbook.steps,
      status: playbook.status,
      updatedAt: playbook.updatedAt
    });

    return {
      id: playbook._id,
      decisionId: playbook.decisionId,
      title: playbook.title,
      description: playbook.description,
      status: playbook.status,
      steps: playbook.steps.map(s => ({
        id: s.id,
        stepNumber: s.stepNumber,
        title: s.title,
        description: s.description,
        status: s.status,
        autoRemediationAvailable: s.autoRemediationAvailable,
        actionType: s.actionType,
        system: s.system,
        details: s.details
      })),
      createdAt: playbook.createdAt.toISOString(),
      updatedAt: playbook.updatedAt.toISOString()
    };
  }
}
