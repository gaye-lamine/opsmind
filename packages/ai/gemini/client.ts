import { type ZodSchema } from "zod";
import { getCloudConfig } from "@opsmind/config";
import { createLogger, AIError, ERROR_CODES } from "@opsmind/shared";

const logger = createLogger("GeminiClient");

/**
 * Gemini Client — the sole interface between OpsMind and Google Gemini.
 *
 * Supports two authentication modes:
 *
 * 1. Google AI Studio (USE_VERTEX_AI=false, default)
 *    - Uses @google/generative-ai SDK
 *    - Requires GEMINI_API_KEY
 *    - For local development and testing
 *
 * 2. Vertex AI with ADC (USE_VERTEX_AI=true)
 *    - Uses @google-cloud/vertexai SDK
 *    - Uses Application Default Credentials (gcloud auth application-default login)
 *    - Requires GOOGLE_CLOUD_PROJECT_ID and GOOGLE_CLOUD_LOCATION
 *    - No API key needed — production-grade, Cloud Run compatible
 *    - ❌ NEVER uses GEMINI_API_KEY in this mode
 *
 * Key design decisions:
 * - ALL outputs are structured JSON validated against Zod schemas (§2.3, §6.4)
 * - Retries on malformed output — up to MAX_RETRIES attempts
 * - Temperature is kept low (0.2) for deterministic reasoning
 * - Never exposes raw text output to callers — always returns typed, validated data
 * - The public interface is identical regardless of auth mode
 */

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ─── Generation Request ───────────────────────────────────────────────────────

export interface GenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  /** Override default temperature for this request */
  temperature?: number;
  /** Override default max tokens */
  maxOutputTokens?: number;
}

export interface GenerationResult<T> {
  data: T;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  retryCount: number;
}

// ─── Gemini Client ────────────────────────────────────────────────────────────

export class GeminiClient {
  private readonly modelName: string;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;
  private readonly useVertexAI: boolean;
  private readonly projectId: string | undefined;
  private readonly location: string;

  constructor() {
    const config = getCloudConfig();

    this.modelName = config.gemini.model;
    this.defaultTemperature = config.gemini.temperature;
    this.defaultMaxTokens = config.gemini.maxOutputTokens;
    this.useVertexAI = config.useVertexAI;
    this.projectId = config.googleCloud.projectId;
    this.location = config.googleCloud.location;

    if (this.useVertexAI) {
      if (!this.projectId) {
        throw new AIError(
          "GOOGLE_CLOUD_PROJECT_ID is required when USE_VERTEX_AI=true",
          ERROR_CODES.AI_GENERATION_FAILED
        );
      }
      logger.info("GeminiClient initialized with Vertex AI (ADC)", {
        model: this.modelName,
        projectId: this.projectId,
        location: this.location,
      });
    } else {
      if (!config.gemini.apiKey) {
        throw new AIError(
          "GEMINI_API_KEY is required when USE_VERTEX_AI=false",
          ERROR_CODES.AI_GENERATION_FAILED
        );
      }
      logger.info("GeminiClient initialized with Google AI Studio (API key)", {
        model: this.modelName,
      });
    }
  }

  /**
   * Generates a structured output validated against the provided Zod schema.
   *
   * This is the ONLY method callers should use. It enforces:
   * - JSON response mode
   * - Zod validation of the output
   * - Automatic retries on malformed output
   * - Full error context on failure
   *
   * Rule §6.4: ALL Gemini outputs MUST be validated before use.
   */
  async generateStructured<T>(
    request: GenerationRequest,
    schema: ZodSchema<T>
  ): Promise<GenerationResult<T>> {
    const start = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = this.useVertexAI
          ? await this.attemptVertexAI<T>(request, schema, attempt)
          : await this.attemptGoogleAI<T>(request, schema, attempt);

        return {
          ...result,
          durationMs: Date.now() - start,
          retryCount: attempt - 1,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn("Gemini generation attempt failed", {
          attempt,
          maxRetries: MAX_RETRIES,
          mode: this.useVertexAI ? "vertex-ai" : "google-ai",
          error: lastError.message,
        });

        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    throw new AIError(
      `Gemini generation failed after ${MAX_RETRIES} attempts: ${lastError?.message ?? "unknown error"}`,
      ERROR_CODES.AI_GENERATION_FAILED,
      { lastError: lastError?.message }
    );
  }

  // ─── Google AI Studio (API Key) ───────────────────────────────────────────

  private async attemptGoogleAI<T>(
    request: GenerationRequest,
    schema: ZodSchema<T>,
    attempt: number
  ): Promise<Omit<GenerationResult<T>, "durationMs" | "retryCount">> {
    const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } =
      await import("@google/generative-ai");

    const config = getCloudConfig();
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey!);

    const generationConfig = {
      temperature: request.temperature ?? this.defaultTemperature,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: request.maxOutputTokens ?? this.defaultMaxTokens,
      responseMimeType: "application/json" as const,
    };

    const model = genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
      systemInstruction: request.systemPrompt,
    });

    logger.debug("Calling Google AI Studio", {
      model: this.modelName,
      attempt,
      promptLength: request.userPrompt.length,
    });

    const response = await model.generateContent(request.userPrompt);
    const candidate = response.response.candidates?.[0];

    if (!candidate) {
      throw new AIError("Gemini returned no candidates", ERROR_CODES.AI_GENERATION_FAILED);
    }

    const rawText = candidate.content.parts
      .map((p) => ("text" in p ? p.text : ""))
      .join("");

    const usage = response.response.usageMetadata;

    return this.parseAndValidate<T>(rawText, schema, attempt, {
      promptTokens: usage?.promptTokenCount ?? 0,
      completionTokens: usage?.candidatesTokenCount ?? 0,
    });
  }

  // ─── Vertex AI (ADC) ──────────────────────────────────────────────────────

  private async attemptVertexAI<T>(
    request: GenerationRequest,
    schema: ZodSchema<T>,
    attempt: number
  ): Promise<Omit<GenerationResult<T>, "durationMs" | "retryCount">> {
    const { VertexAI, HarmCategory, HarmBlockThreshold } =
      await import("@google-cloud/vertexai");

    const vertexAI = new VertexAI({
      project: this.projectId!,
      location: this.location,
    });

    const model = vertexAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: request.temperature ?? this.defaultTemperature,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: request.maxOutputTokens ?? this.defaultMaxTokens,
        responseMimeType: "application/json",
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
      systemInstruction: {
        role: "system",
        parts: [{ text: request.systemPrompt }],
      },
    });

    logger.debug("Calling Vertex AI (ADC)", {
      model: this.modelName,
      project: this.projectId,
      location: this.location,
      attempt,
      promptLength: request.userPrompt.length,
    });

    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
    });

    const candidate = response.response.candidates?.[0];

    if (!candidate) {
      throw new AIError("Vertex AI returned no candidates", ERROR_CODES.AI_GENERATION_FAILED);
    }

    const rawText = candidate.content.parts
      .map((p) => ("text" in p ? (p as { text: string }).text : ""))
      .join("");

    const usage = response.response.usageMetadata;

    return this.parseAndValidate<T>(rawText, schema, attempt, {
      promptTokens: usage?.promptTokenCount ?? 0,
      completionTokens: usage?.candidatesTokenCount ?? 0,
    });
  }

  // ─── Shared parsing & validation ─────────────────────────────────────────

  private parseAndValidate<T>(
    rawText: string,
    schema: ZodSchema<T>,
    attempt: number,
    usage: { promptTokens: number; completionTokens: number }
  ): Omit<GenerationResult<T>, "durationMs" | "retryCount"> {
    if (!rawText.trim()) {
      throw new AIError("Gemini returned empty response", ERROR_CODES.AI_GENERATION_FAILED);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      if (attempt < MAX_RETRIES) {
        throw new AIError(
          `Gemini returned non-JSON response (attempt ${attempt}): ${rawText.slice(0, 200)}`,
          ERROR_CODES.AI_SCHEMA_VALIDATION_FAILED
        );
      }
      throw new AIError(
        "Gemini returned non-JSON response after all retries",
        ERROR_CODES.AI_SCHEMA_VALIDATION_FAILED,
        { rawText: rawText.slice(0, 500) }
      );
    }

    const validation = schema.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ");

      throw new AIError(
        `Gemini output failed schema validation (attempt ${attempt}): ${issues}`,
        ERROR_CODES.AI_SCHEMA_VALIDATION_FAILED,
        { issues: validation.error.issues }
      );
    }

    return {
      data: validation.data,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _client: GeminiClient | null = null;

export function getGeminiClient(): GeminiClient {
  if (_client === null) {
    _client = new GeminiClient();
  }
  return _client;
}

// ─── Embedding ────────────────────────────────────────────────────────────────

/**
 * Generates a text embedding vector for semantic similarity search.
 *
 * Used by the memory layer to embed decisions for Atlas Vector Search.
 * The embedding model is separate from the generation model:
 * - Vertex AI: text-embedding-004 (768 dimensions)
 * - Google AI Studio: text-embedding-004 (768 dimensions)
 *
 * Returns a float[] of 768 dimensions, or null if embedding fails.
 * Failure is non-fatal — the decision is persisted without an embedding
 * and falls back to recency-based retrieval.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const config = getCloudConfig();
  const embeddingModel = "text-embedding-004";

  try {
    const { GoogleGenAI } = await import("@google/genai");

    // Unified client configuration for both Google AI and Vertex AI
    const client = new GoogleGenAI(config.useVertexAI ? {
      project: config.googleCloud.projectId!,
      location: config.googleCloud.location,
      vertexai: true,
    } : {
      apiKey: config.gemini.apiKey!,
    });

    const response = await client.models.embedContent({
      model: embeddingModel,
      contents: [text.slice(0, 2048)],
      config: {
        outputDimensionality: 768,
      },
    });

    const embedding = response.embeddings?.[0]?.values;
    
    if (!Array.isArray(embedding)) {
      logger.warn("Gemini returned invalid embedding format", { response });
      return null;
    }

    return embedding;
  } catch (error) {
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : { message: String(error) };

    logger.error("Embedding generation CRITICAL failure", {
      ...errorDetails,
      textLength: text.length,
      configMode: config.useVertexAI ? "vertex" : "studio",
      hasProjectId: !!config.googleCloud.projectId
    });
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
