import { z, type ZodSchema } from "zod";
import type { ApiError } from "../types/api";
import { ERROR_CODES } from "../constants/index";

/**
 * Validation utilities for OpsMind.
 * All validation uses Zod — never raw type assertions.
 */

export interface ValidationResult<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  error: ApiError;
}

export type ValidationOutcome<T> = ValidationResult<T> | ValidationFailure;

/**
 * Validates data against a Zod schema.
 * Returns a typed result — never throws.
 */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationOutcome<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const details: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!details[path]) details[path] = [];
    details[path]!.push(issue.message);
  }

  return {
    success: false,
    error: {
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Validation failed",
      details,
    },
  };
}

/**
 * Validates data and throws a structured error on failure.
 * Use at system boundaries where invalid data is a programming error.
 */
export function validateOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = validate(schema, data);
  if (!result.success) {
    throw new ValidationError(result.error.message, result.error.details);
  }
  return result.data;
}

// ─── Domain Errors ────────────────────────────────────────────────────────────

export class OpsMindError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OpsMindError";
  }
}

export class ValidationError extends OpsMindError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ERROR_CODES.VALIDATION_ERROR, details);
    this.name = "ValidationError";
  }
}

export class AgentError extends OpsMindError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = "AgentError";
  }
}

export class MemoryError extends OpsMindError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = "MemoryError";
  }
}

export class AIError extends OpsMindError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = "AIError";
  }
}

export class ToolError extends OpsMindError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = "ToolError";
  }
}
