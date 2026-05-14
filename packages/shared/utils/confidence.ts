import { DECISION_CONSTANTS } from "../constants/index";
import type { ConfidenceLevel } from "../types/decision";

/**
 * Confidence scoring utilities.
 * Converts raw 0–1 scores into labeled confidence levels.
 */

export function scoreToConfidenceLevel(score: number): ConfidenceLevel {
  const levels = DECISION_CONSTANTS.CONFIDENCE_LEVELS;

  if (score >= levels.VERY_HIGH.min) return "very_high";
  if (score >= levels.HIGH.min) return "high";
  if (score >= levels.MEDIUM.min) return "medium";
  return "low";
}

export function isConfidenceAcceptable(
  score: number,
  threshold: number
): boolean {
  return score >= threshold;
}

/**
 * Clamps a confidence score to the valid 0–1 range.
 */
export function clampConfidence(score: number): number {
  return Math.max(0, Math.min(1, score));
}
