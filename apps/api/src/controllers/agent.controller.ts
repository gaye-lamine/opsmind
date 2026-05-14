import { type Request, type Response, type NextFunction } from "express";
import { successResponse, errorResponse } from "@opsmind/shared";
import { type StartAgentSessionDto } from "@opsmind/shared";
import { AgentService } from "../services/agent.service";
import { getValidatedBody, getValidatedQuery } from "../middleware/validate.middleware";
import { type AgentSessionQueryDto } from "@opsmind/shared";
import { getSseEventStore } from "@opsmind/agent";

/**
 * Agent Controller — handles agent session lifecycle endpoints.
 *
 * Rule §3.2: Controllers ONLY handle HTTP concerns.
 *
 * Session flow:
 * - POST /sessions → runs pipeline synchronously, returns full result when done
 * - GET  /sessions/:id/stream → SSE stream of pipeline events (for live UI)
 * - GET  /sessions/:id → poll session status from MongoDB
 */
export class AgentController {
  private readonly service = new AgentService();

  /**
   * POST /api/agent/sessions
   *
   * Starts an agent session asynchronously.
   * Returns the sessionId immediately — pipeline runs in background.
   * Events are streamed via SSE (GET /api/agent/sessions/:id/stream).
   */
  startSession = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const dto = getValidatedBody<StartAgentSessionDto>(req);
      const requestId = req.headers["x-request-id"] as string | undefined;

      const sessionId = this.service.startSessionAsync(dto);

      res.status(201).json(
        successResponse(
          {
            sessionId,
            status: "pending",
          },
          { requestId }
        )
      );
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/agent/sessions/sync
   *
   * Runs the full reasoning pipeline synchronously.
   * Returns the complete result (including decisionId) when done.
   */
  startSessionSync = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const dto = getValidatedBody<StartAgentSessionDto>(req);
      const requestId = req.headers["x-request-id"] as string | undefined;

      const result = await this.service.startSession(dto);

      if (result.success) {
        res.status(201).json(
          successResponse(
            {
              sessionId: result.sessionId,
              decisionId: result.decision.id,
              status: "completed",
              summary: result.decision.summary,
              confidenceScore: result.decision.confidenceScore,
              confidenceLevel: result.decision.confidenceLevel,
              findingsCount: result.decision.findings.length,
              recommendationsCount: result.decision.recommendations.length,
              durationMs: result.durationMs,
            },
            { requestId, durationMs: result.durationMs }
          )
        );
      } else {
        res.status(500).json(
          errorResponse(
            {
              code: result.error.code,
              message: result.error.message,
            },
            { requestId }
          )
        );
      }
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/agent/sessions/:sessionId/stream
   *
   * Server-Sent Events endpoint — streams pipeline events in real time.
   * Connect to this endpoint after starting a session to see live progress.
   */
  streamSession = (req: Request, res: Response): void => {
    const { sessionId } = req.params as { sessionId: string };
    const fromIndex = parseInt((req.query["from"] as string | undefined) ?? "0", 10);

    const eventStore = getSseEventStore();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    if (!eventStore.hasSession(sessionId)) {
      res.write(`data: ${JSON.stringify({ type: "session_not_found", sessionId })}\n\n`);
      res.end();
      return;
    }

    let cursor = fromIndex;
    let closed = false;

    const sendEvents = (): void => {
      if (closed) return;

      const { events, completed } = eventStore.getEvents(sessionId, cursor);

      for (const event of events) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        cursor++;
      }

      if (completed && events.length === 0) {
        res.end();
        closed = true;
        clearInterval(intervalId);
      }
    };

    const intervalId = setInterval(sendEvents, 300);
    sendEvents();

    req.on("close", () => {
      closed = true;
      clearInterval(intervalId);
    });
  };

  /**
   * GET /api/agent/sessions/:sessionId
   */
  getSessionStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { sessionId } = req.params as { sessionId: string };
      const requestId = req.headers["x-request-id"] as string | undefined;
      const status = await this.service.getSessionStatus(sessionId);
      res.json(successResponse(status, { requestId }));
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/agent/sessions
   */
  listSessions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = getValidatedQuery<AgentSessionQueryDto>(req);
      const requestId = req.headers["x-request-id"] as string | undefined;
      const sessions = await this.service.getRecentSessions(query.pageSize);
      res.json(successResponse({ sessions, total: sessions.length }, { requestId }));
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/agent/sessions/active
   */
  getActiveSessions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const requestId = req.headers["x-request-id"] as string | undefined;
      const sessions = await this.service.getActiveSessions();
      res.json(successResponse({ sessions, total: sessions.length }, { requestId }));
    } catch (err) {
      next(err);
    }
  };
}
