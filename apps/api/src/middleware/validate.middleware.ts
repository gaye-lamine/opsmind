import { type Request, type Response, type NextFunction } from "express";
import { type ZodSchema } from "zod";
import { validate, errorResponse } from "@opsmind/shared";

/**
 * Validation middleware factory.
 *
 * Rule §9: All routes MUST validate input before processing.
 * Returns 400 with structured error details on validation failure.
 *
 * Usage:
 *   router.post('/sessions', validateBody(startAgentSessionSchema), controller.startSession)
 */

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = validate(schema, req.body);

    if (!result.success) {
      res.status(400).json(
        errorResponse(result.error, {
          requestId: req.headers["x-request-id"] as string | undefined,
        })
      );
      return;
    }

    // Attach validated body to request for type-safe access in controllers
    (req as Request & { validatedBody: T }).validatedBody = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = validate(schema, req.query);

    if (!result.success) {
      res.status(400).json(
        errorResponse(result.error, {
          requestId: req.headers["x-request-id"] as string | undefined,
        })
      );
      return;
    }

    (req as Request & { validatedQuery: T }).validatedQuery = result.data;
    next();
  };
}

// Type helpers for controllers to access validated data
export function getValidatedBody<T>(req: Request): T {
  return (req as Request & { validatedBody: T }).validatedBody;
}

export function getValidatedQuery<T>(req: Request): T {
  return (req as Request & { validatedQuery: T }).validatedQuery;
}
