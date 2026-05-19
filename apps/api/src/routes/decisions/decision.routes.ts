import { Router, type Router as ExpressRouter } from "express";
import { DecisionController } from "../../controllers/decision.controller";
import { PlaybookController } from "../../controllers/playbook.controller";
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
const playbookController = new PlaybookController();

router.get("/search", controller.searchDecisions);

router.get(
  "/",
  validateQuery(decisionQuerySchema),
  controller.listDecisions
);

// Must be before /:id to avoid route conflict
router.get("/:id/executed-actions", controller.getExecutedActions);
router.get("/:id/similar", controller.getSimilarDecisions);

// Playbook endpoints
router.get("/:id/playbook", playbookController.getOrCreatePlaybook);
router.post("/:id/playbook/steps/:stepId/execute", playbookController.executePlaybookStep);
router.post("/:id/playbook/steps/:stepId/toggle", playbookController.togglePlaybookStep);

router.get("/:id", controller.getDecision);

export { router as decisionRouter };
