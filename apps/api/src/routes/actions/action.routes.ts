import { Router, type Router as ExpressRouter } from "express";
import { ActionController } from "../../controllers/action.controller";
import { validateBody } from "../../middleware/validate.middleware";
import { updateActionStatusSchema } from "@opsmind/shared";

/**
 * Action routes — action recommendation lifecycle management.
 *
 * GET   /api/actions/pending                    — all pending actions
 * GET   /api/actions/decision/:decisionId       — actions for a decision
 * PATCH /api/actions/:id/status                 — update action status
 * POST  /api/actions/:id/outcome                — record action outcome
 */
const router: ExpressRouter = Router();
const controller = new ActionController();

router.get("/pending", controller.getPendingActions);

router.get("/decision/:decisionId", controller.getActionsByDecision);

router.patch(
  "/:id/status",
  validateBody(updateActionStatusSchema),
  controller.updateActionStatus
);

router.post("/:id/outcome", controller.recordOutcome);

export { router as actionRouter };
