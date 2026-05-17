import { Router } from "express";
import { AgentController } from "../../controllers/agent.controller";
import { validateBody, validateQuery } from "../../middleware/validate.middleware";
import { startAgentSessionSchema, agentSessionQuerySchema } from "@opsmind/shared";

/**
 * Agent routes — session lifecycle management.
 *
 * POST   /api/agent/sessions              — start async session (returns sessionId immediately)
 * GET    /api/agent/sessions/:id/stream   — SSE stream of pipeline events
 * GET    /api/agent/sessions/active       — list active sessions
 * GET    /api/agent/sessions              — list recent sessions
 * GET    /api/agent/sessions/:id          — get session status
 */
const router: Router = Router();
const controller = new AgentController();

router.post(
  "/sessions",
  validateBody(startAgentSessionSchema),
  controller.startSession
);

router.post(
  "/sessions/sync",
  validateBody(startAgentSessionSchema),
  controller.startSessionSync
);

// SSE stream — must be before /:sessionId to avoid route conflict
router.get("/sessions/:sessionId/stream", controller.streamSession);

router.get("/sessions/active", controller.getActiveSessions);

router.get(
  "/sessions",
  validateQuery(agentSessionQuerySchema),
  controller.listSessions
);

router.get("/sessions/:sessionId", controller.getSessionStatus);

export { router as agentRouter };
