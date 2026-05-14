import { type Request, type Response, type NextFunction } from "express";
import { successResponse } from "@opsmind/shared";
import { type UpdateActionStatusDto } from "@opsmind/shared";
import { ActionService } from "../services/action.service";
import { getValidatedBody } from "../middleware/validate.middleware";

/**
 * Action Controller — handles action recommendation lifecycle endpoints.
 *
 * Rule §3.2: Controllers ONLY handle HTTP concerns.
 */
export class ActionController {
  private readonly service = new ActionService();

  /**
   * GET /api/actions/pending
   * Returns all pending action recommendations.
   */
  getPendingActions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const requestId = req.headers["x-request-id"] as string | undefined;
      const actions = await this.service.getPendingActions();

      res.json(
        successResponse(
          {
            actions: actions.map((a) => ({
              id: a._id,
              decisionId: a.decisionId,
              title: a.title,
              description: a.description,
              rationale: a.rationale,
              priority: a.priority,
              status: a.status,
              estimatedImpact: a.estimatedImpact,
              timeframe: a.timeframe,
              risks: a.risks,
              createdAt: a.createdAt.toISOString(),
            })),
            total: actions.length,
          },
          { requestId }
        )
      );
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/actions/decision/:decisionId
   * Returns all actions for a specific decision.
   */
  getActionsByDecision = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { decisionId } = req.params as { decisionId: string };
      const requestId = req.headers["x-request-id"] as string | undefined;

      const actions = await this.service.getActionsByDecision(decisionId);

      res.json(
        successResponse(
          {
            actions: actions.map((a) => ({
              id: a._id,
              decisionId: a.decisionId,
              title: a.title,
              description: a.description,
              rationale: a.rationale,
              priority: a.priority,
              status: a.status,
              estimatedImpact: a.estimatedImpact,
              timeframe: a.timeframe,
              risks: a.risks,
              createdAt: a.createdAt.toISOString(),
            })),
            total: actions.length,
          },
          { requestId }
        )
      );
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /api/actions/:id/status
   * Updates the status of an action recommendation.
   */
  updateActionStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const dto = getValidatedBody<UpdateActionStatusDto>(req);
      const requestId = req.headers["x-request-id"] as string | undefined;

      await this.service.updateStatus(id, dto.status, dto.notes);

      res.json(
        successResponse(
          { actionId: id, status: dto.status, updatedAt: new Date().toISOString() },
          { requestId }
        )
      );
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/actions/:id/outcome
   * Records the outcome of a completed action — closes the feedback loop.
   */
  recordOutcome = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const requestId = req.headers["x-request-id"] as string | undefined;

      const { wasSuccessful, notes, measuredImpact } = req.body as {
        wasSuccessful: boolean;
        notes: string;
        measuredImpact?: string;
      };

      await this.service.recordOutcome(id, wasSuccessful, notes, measuredImpact);

      res.json(
        successResponse(
          { actionId: id, outcomeRecorded: true, recordedAt: new Date().toISOString() },
          { requestId }
        )
      );
    } catch (err) {
      next(err);
    }
  };
}
