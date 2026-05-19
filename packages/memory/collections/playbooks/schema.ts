import { z } from "zod";

const playbookStepDocumentSchema = z.object({
  id: z.string(),
  stepNumber: z.number(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["pending", "completed", "skipped"]),
  autoRemediationAvailable: z.boolean(),
  actionType: z.string().optional(),
  system: z.string().optional(),
  details: z.record(z.any()).optional(),
});

export const playbookDocumentSchema = z.object({
  _id: z.string(), // matches decisionId
  decisionId: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["draft", "active", "completed", "failed"]),
  steps: z.array(playbookStepDocumentSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PlaybookDocument = z.infer<typeof playbookDocumentSchema>;
export const insertPlaybookSchema = playbookDocumentSchema;
export type InsertPlaybookDocument = PlaybookDocument;

export const updatePlaybookSchema = playbookDocumentSchema
  .omit({ _id: true, decisionId: true, createdAt: true })
  .partial();
export type UpdatePlaybookDocument = z.infer<typeof updatePlaybookSchema>;
