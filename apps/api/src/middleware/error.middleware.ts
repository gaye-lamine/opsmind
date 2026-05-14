import { type Request, type Response, type NextFunction } from "express";
import { createLogger, ERROR_CODES, OpsMindError } from "@opsmind/shared";
import { errorResponse } from "@opsmind/shared";

const logger = createLogger("ErrorMiddleware");

/**
 * Global error handler middleware.
 *
 * Rule §10: NEVER swallow errors. All failures MUST be logged with context.
 * Rule §9: All routes return typed responses with the standard envelope.
 *
 * Must be registered LAST in the Express middleware chain.
 */
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req.headers["x-request-id"] as string | undefined) ?? "unknown";

  if (err instanceof OpsMindError) {
    logger.error("OpsMind domain error", err, {
      requestId,
      path: req.path,
      method: req.method,
      code: err.code,
    });

    const statusCode = mapErrorCodeToStatus(err.code);
    res.status(statusCode).json(
      errorResponse(
        { code: err.code, message: err.message },
        { requestId }
      )
    );
    return;
  }

  if (err instanceof Error) {
    logger.error("Unhandled error", err, {
      requestId,
      path: req.path,
      method: req.method,
    });

    res.status(500).json(
      errorResponse(
        {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: "An unexpected error occurred",
        },
        { requestId }
      )
    );
    return;
  }

  logger.error("Unknown error type", undefined, {
    requestId,
    path: req.path,
    err: String(err),
  });

  res.status(500).json(
    errorResponse(
      { code: ERROR_CODES.INTERNAL_ERROR, message: "An unexpected error occurred" },
      { requestId }
    )
  );
}

function mapErrorCodeToStatus(code: string): number {
  const statusMap: Record<string, number> = {
    [ERROR_CODES.VALIDATION_ERROR]: 400,
    [ERROR_CODES.INVALID_INPUT]: 400,
    [ERROR_CODES.AGENT_SESSION_NOT_FOUND]: 404,
    [ERROR_CODES.DECISION_NOT_FOUND]: 404,
    [ERROR_CODES.TOOL_NOT_FOUND]: 404,
    [ERROR_CODES.AGENT_TIMEOUT]: 408,
    [ERROR_CODES.AI_RATE_LIMITED]: 429,
    [ERROR_CODES.AGENT_REASONING_FAILED]: 500,
    [ERROR_CODES.AI_GENERATION_FAILED]: 500,
    [ERROR_CODES.MEMORY_READ_FAILED]: 500,
    [ERROR_CODES.MEMORY_WRITE_FAILED]: 500,
    [ERROR_CODES.DATABASE_ERROR]: 503,
    [ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
  };
  return statusMap[code] ?? 500;
}
