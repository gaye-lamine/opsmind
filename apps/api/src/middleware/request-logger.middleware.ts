import { type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "crypto";
import { createLogger } from "@opsmind/shared";

const logger = createLogger("RequestLogger");

/**
 * Request logger middleware.
 * Attaches a request ID to every request and logs timing.
 *
 * Rule §10: All failures must include traceability — the request ID
 * is propagated through the entire request lifecycle.
 */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = randomUUID();
  const start = Date.now();

  // Attach request ID to request and response headers
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);

  logger.info("Incoming request", {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
  });

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger[level]("Request completed", {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}
