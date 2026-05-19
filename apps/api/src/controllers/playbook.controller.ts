import { type Request, type Response, type NextFunction } from "express";
import { successResponse } from "@opsmind/shared";
import { PlaybookService } from "../services/playbook.service";

/**
 * Playbook Controller — handles playbook endpoints.
 */
export class PlaybookController {
  private readonly service = new PlaybookService();

  /**
   * GET /api/decisions/:id/playbook
   * Retrieves or dynamically generates a playbook for an incident.
   */
  getOrCreatePlaybook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const decisionId = req.params.id;
      const playbook = await this.service.getOrCreatePlaybook(decisionId);
      res.json(successResponse(playbook));
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/decisions/:id/playbook/steps/:stepId/execute
   * Executes an automated step in the playbook.
   */
  executePlaybookStep = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id: decisionId, stepId } = req.params;
      const playbook = await this.service.executePlaybookStep(decisionId, stepId);
      res.json(successResponse(playbook));
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/decisions/:id/playbook/steps/:stepId/toggle
   * Manually toggles a step's status.
   */
  togglePlaybookStep = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id: decisionId, stepId } = req.params;
      const { status } = req.body;
      
      if (!status || !["pending", "completed", "skipped"].includes(status)) {
        res.status(400).json({ error: "Invalid or missing step status" });
        return;
      }

      const playbook = await this.service.togglePlaybookStep(decisionId, stepId, status);
      res.json(successResponse(playbook));
    } catch (error) {
      next(error);
    }
  };
}
