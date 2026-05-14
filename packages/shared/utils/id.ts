import { randomUUID } from "crypto";

/**
 * ID generation utilities.
 * All IDs in OpsMind are UUIDs v4 — no external dependencies needed.
 */

export function generateId(): string {
  return randomUUID();
}

export function generateSessionId(): string {
  return `session_${randomUUID()}`;
}

export function generateDecisionId(): string {
  return `decision_${randomUUID()}`;
}

export function generateActionId(): string {
  return `action_${randomUUID()}`;
}

export function generateFindingId(): string {
  return `finding_${randomUUID()}`;
}

export function generateLogId(): string {
  return `log_${randomUUID()}`;
}
