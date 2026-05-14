import { Router, type Request, type Response, type NextFunction } from "express";
import { successResponse } from "@opsmind/shared";
import { getMonitoringLoop } from "@opsmind/agent";

/**
 * Monitoring routes — autonomous anomaly detection and investigation.
 *
 * POST /api/monitoring/check — trigger an immediate monitoring scan
 *   Reads current operational state, detects qualifying anomalies,
 *   and launches autonomous investigations for each one.
 *   Returns a summary of what was detected and launched.
 *
 * This endpoint is also called by the scheduled monitoring loop
 * (configured in server/index.ts via setInterval).
 */
const router = Router();

router.post("/check", async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const monitoringLoop = getMonitoringLoop();
    const result = await monitoringLoop.check();

    res.status(200).json(
      successResponse({
        checkedAt: result.checkedAt.toISOString(),
        anomaliesDetected: result.anomaliesDetected,
        investigationsLaunched: result.investigationsLaunched,
        investigationsSkipped: result.investigationsSkipped,
        launchedSessionIds: result.launchedSessionIds,
        anomalySummary: result.anomalySummary,
      })
    );
  } catch (err) {
    next(err);
  }
});

export { router as monitoringRouter };
