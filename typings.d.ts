declare module "@opsmind/config";

declare module "@opsmind/shared" {
  export interface Decision {
    id: string;
    goal: string;
    summary: string;
    confidenceScore: number;
    confidenceLevel: string;
    status: string;
    findings: any[];
    recommendations: any[];
    reflection?: DecisionReflection;
    updatedAt: Date;
  }

  export interface DecisionReflection {
    confidenceAssessment: string;
    reasoningQuality: string;
    identifiedRisks: string[];
    alternativeApproaches: string[];
    limitations: string[];
    improvementSuggestions: string[];
    overallScore: number;
  }

  export function createLogger(name: string): any;
  export function clampConfidence(val: number): number;
  export class AIError extends Error {
    constructor(message: string, code?: string, details?: any);
    code?: string;
    details?: any;
  }
  export const ERROR_CODES: any;
}

declare module "@opsmind/ai";
declare module "@opsmind/memory";
declare module "@opsmind/agent";
declare module "@opsmind/tools";
declare module "@opsmind/mcp-client";
