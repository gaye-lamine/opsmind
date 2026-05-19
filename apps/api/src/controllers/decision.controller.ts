import { type Request, type Response, type NextFunction } from "express";
import { successResponse, buildPagination } from "@opsmind/shared";
import { type DecisionQueryDto } from "@opsmind/shared";
import { DecisionService } from "../services/decision.service";
import { getValidatedQuery } from "../middleware/validate.middleware";

/**
 * Decision Controller — handles decision retrieval endpoints.
 *
 * Rule §3.2: Controllers ONLY handle HTTP concerns.
 * All data access is delegated to DecisionService.
 */
export class DecisionController {
  private readonly service = new DecisionService();

  /**
   * GET /api/decisions/search?q=...
   * Performs a hybrid search over decisions.
   */
  searchDecisions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;
      const requestId = req.headers["x-request-id"] as string | undefined;

      if (!query) {
        res.status(400).json({ error: "Missing search query 'q'" });
        return;
      }

      const result = await this.service.searchDecisions(query, limit);

      res.json(
        successResponse(
          {
            decisions: result.items.map((d) => ({
              id: d.id,
              sessionId: d.sessionId,
              goal: d.goal,
              category: d.category,
              status: d.status,
              confidenceLevel: d.confidenceLevel,
              confidenceScore: d.confidenceScore,
              summary: d.summary,
              recommendationCount: d.recommendations.length,
              createdAt: d.createdAt.toISOString(),
              searchScore: (d as any).searchScore,
              searchType: (d as any).searchType,
              highlightText: (d as any).highlightText,
              rerankedByVoyage: (d as any).rerankedByVoyage,
            })),
            total: result.total,
          },
          { requestId }
        )
      );
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/decisions/:id/similar
   * Finds decisions similar to this one using Vector Search.
   */
  getSimilarDecisions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const limit = parseInt(req.query.limit as string) || 3;
      const requestId = req.headers["x-request-id"] as string | undefined;

      const result = await this.service.getSimilarDecisions(id, limit);

      res.json(
        successResponse(
          {
            decisions: result.items.map((d) => ({
              id: d.id,
              sessionId: d.sessionId,
              goal: d.goal,
              category: d.category,
              status: d.status,
              confidenceLevel: d.confidenceLevel,
              confidenceScore: d.confidenceScore,
              summary: d.summary,
              recommendationCount: d.recommendations.length,
              createdAt: d.createdAt.toISOString(),
              searchScore: (d as any).searchScore,
              searchType: (d as any).searchType,
            })),
            total: result.total,
          },
          { requestId }
        )
      );
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/decisions
   * Returns a paginated list of decisions with optional filters.
   */
  listDecisions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = getValidatedQuery<DecisionQueryDto>(req);
      const requestId = req.headers["x-request-id"] as string | undefined;

      const result = await this.service.listDecisions(query);
      const pagination = buildPagination(query.page, query.pageSize, result.total);

      res.json(
        successResponse(
          {
            decisions: result.items.map((d) => ({
              id: d._id,
              sessionId: d.sessionId,
              goal: d.goal,
              category: d.category,
              status: d.status,
              confidenceLevel: d.confidenceLevel,
              confidenceScore: d.confidenceScore,
              summary: d.summary,
              recommendationCount: d.recommendations.length,
              createdAt: d.createdAt.toISOString(),
            })),
            pagination,
          },
          { requestId, pagination }
        )
      );
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/decisions/:id
   */
  getDecision = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const requestId = req.headers["x-request-id"] as string | undefined;

      const decision = await this.service.getDecisionById(id);

      res.json(successResponse({ decision }, { requestId }));
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/decisions/:id/executed-actions
   * Returns the real actions executed by the agent for this decision.
   */
  getExecutedActions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const requestId = req.headers["x-request-id"] as string | undefined;

      const actions = await this.service.getExecutedActions(id);

      res.json(successResponse({ actions, total: actions.length }, { requestId }));
    } catch (err) {
      next(err);
    }
  };
}
