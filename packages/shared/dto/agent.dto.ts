import { z } from "zod";

/**
 * Agent DTOs — validated data transfer objects for agent interactions.
 */

// ─── Start Agent Session ──────────────────────────────────────────────────────

export const startAgentSessionSchema = z.object({
  goal: z
    .string()
    .min(10, "Goal must be at least 10 characters")
    .max(2000, "Goal must not exceed 2000 characters"),
  context: z
    .object({
      domain: z.string().max(100).optional(),
      timeframe: z.string().max(100).optional(),
      metrics: z.array(z.string().max(100)).max(20).optional(),
    })
    .optional(),
});

export type StartAgentSessionDto = z.infer<typeof startAgentSessionSchema>;

// ─── Agent Session Query ──────────────────────────────────────────────────────

export const agentSessionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z
    .enum([
      "initializing",
      "running",
      "reflecting",
      "completed",
      "failed",
      "timeout",
    ])
    .optional(),
});

export type AgentSessionQueryDto = z.infer<typeof agentSessionQuerySchema>;
