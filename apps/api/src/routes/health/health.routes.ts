import { Router, type Router as ExpressRouter, type Request, type Response } from "express";
import { getAgentRuntime } from "@opsmind/agent";
import { successResponse } from "@opsmind/shared";

/**
 * Health routes — system health and readiness checks.
 * Used by load balancers, monitoring, and the frontend.
 */
const router: ExpressRouter = Router();

/**
 * GET /api/health
 * Basic liveness check — returns 200 if the server is running.
 */
router.get("/", (_req: Request, res: Response): void => {
  res.json(
    successResponse({
      status: "ok",
      service: "opsmind-api",
      timestamp: new Date().toISOString(),
    })
  );
});

/**
 * GET /api/health/ready
 * Readiness check — verifies all dependencies are healthy.
 * Returns 503 if MongoDB or tool registry is unavailable.
 */
router.get("/ready", async (_req: Request, res: Response): Promise<void> => {
  try {
    const runtime = getAgentRuntime();
    const health = await runtime.healthCheck();

    const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

    res.status(statusCode).json(
      successResponse({
        status: health.status,
        mongodb: health.mongodb,
        toolRegistry: health.toolRegistry,
        details: health.details,
        timestamp: new Date().toISOString(),
      })
    );
  } catch {
    res.status(503).json(
      successResponse({
        status: "unhealthy",
        mongodb: false,
        toolRegistry: false,
        timestamp: new Date().toISOString(),
      })
    );
  }
});

export { router as healthRouter };
