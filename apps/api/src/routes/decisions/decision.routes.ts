import { Router, type Router as ExpressRouter } from "express";
import { DecisionController } from "../../controllers/decision.controller";
import { validateQuery } from "../../middleware/validate.middleware";
import { decisionQuerySchema } from "@opsmind/shared";

/**
 * Decision routes — decision retrieval and inspection.
 *
 * GET /api/decisions                      — paginated list with filters
 * GET /api/decisions/:id                  — full decision detail
 * GET /api/decisions/:id/executed-actions — real actions executed by the agent
 */
const router: ExpressRouter = Router();
const controller = new DecisionController();

router.get(
  "/",
  validateQuery(decisionQuerySchema),
  controller.listDecisions
);

// Must be before /:id to avoid route conflict
router.get("/:id/executed-actions", controller.getExecutedActions);

router.get("/:id", controller.getDecision);

export { router as decisionRouter };
