import { type Request, type Response, type NextFunction } from "express";
import { successResponse } from "@opsmind/shared";
import { DashboardService } from "../services/dashboard.service";

/**
 * Dashboard Controller — serves the operational intelligence dashboard state.
 */
export class DashboardController {
  private readonly service = new DashboardService();

  /**
   * GET /api/dashboard
   * Returns the complete dashboard state:
   * - Current operational state (metrics, anomalies)
   * - Recent decisions
   * - Pending actions
   * - System health
   */
  getDashboardState = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const requestId = req.headers["x-request-id"] as string | undefined;
      const state = await this.service.getDashboardState();
      res.json(successResponse(state, { requestId }));
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/dashboard/mongodb-stats
   * Returns live MongoDB document counts.
   */
  getMongoDbStats = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const requestId = req.headers["x-request-id"] as string | undefined;
      const stats = await this.service.getMongoDbStats();
      res.json(successResponse({ stats }, { requestId }));
    } catch (err) {
      next(err);
    }
  };
}
