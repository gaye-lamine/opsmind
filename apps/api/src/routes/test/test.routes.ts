import { Router, type Request, type Response } from "express";
import { getGeminiClient } from "@opsmind/ai";
import { getCloudConfig } from "@opsmind/config";
import { z } from "zod";

/**
 * Test routes — development/validation only.
 *
 * GET /test/gemini — validates the Gemini/Vertex AI integration end-to-end.
 * Returns a simple structured response from the LLM.
 *
 * This endpoint is intentionally simple — it exists only to confirm
 * that the LLM client is correctly configured and reachable.
 */
export const testRouter = Router();

const testResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
  timestamp: z.string(),
});

testRouter.get("/gemini", async (_req: Request, res: Response): Promise<void> => {
  const start = Date.now();

  try {
    const config = getCloudConfig();
    const client = getGeminiClient();

    const result = await client.generateStructured(
      {
        systemPrompt:
          "You are a health check assistant. Respond with a simple JSON status message.",
        userPrompt:
          'Respond with a JSON object confirming you are operational. ' +
          'Use this exact structure: { "status": "ok", "message": "Gemini is operational", "timestamp": "<ISO datetime>" }',
        temperature: 0,
      },
      testResponseSchema
    );

    res.status(200).json({
      success: true,
      data: {
        llmResponse: result.data,
        meta: {
          model: config.gemini.model,
          mode: config.useVertexAI ? "vertex-ai-adc" : "google-ai-studio",
          projectId: config.useVertexAI ? config.googleCloud.projectId : undefined,
          location: config.useVertexAI ? config.googleCloud.location : undefined,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          durationMs: result.durationMs,
          retryCount: result.retryCount,
          totalDurationMs: Date.now() - start,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      success: false,
      error: {
        code: "GEMINI_TEST_FAILED",
        message,
      },
    });
  }
});
