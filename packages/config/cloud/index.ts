import { getEnv } from "../env/loader";

export interface GeminiConfig {
  /**
   * API key for Google AI Studio (used when useVertexAI = false).
   * Undefined when using Vertex AI with ADC.
   */
  apiKey: string | undefined;
  model: string;
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  topK: number;
}

export interface GoogleCloudConfig {
  projectId: string | undefined;
  location: string;
  applicationCredentials: string | undefined;
}

export interface CloudConfig {
  /**
   * When true, use Vertex AI with Application Default Credentials (ADC).
   * When false, use Google AI Studio with GEMINI_API_KEY.
   */
  useVertexAI: boolean;
  gemini: GeminiConfig;
  googleCloud: GoogleCloudConfig;
}

/**
 * Google Cloud and Gemini configuration.
 *
 * Two authentication modes:
 * - useVertexAI = false (default): Google AI Studio, requires GEMINI_API_KEY
 * - useVertexAI = true:            Vertex AI, uses ADC (gcloud auth application-default login)
 *
 * Temperature is kept low (0.2 default) for deterministic reasoning outputs.
 */
export function getCloudConfig(): CloudConfig {
  const env = getEnv();

  return {
    useVertexAI: env.USE_VERTEX_AI,
    gemini: {
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
      maxOutputTokens: env.GEMINI_MAX_TOKENS,
      temperature: env.GEMINI_TEMPERATURE,
      topP: 0.95,
      topK: 40,
    },
    googleCloud: {
      projectId: env.GOOGLE_CLOUD_PROJECT_ID,
      location: env.GOOGLE_CLOUD_LOCATION,
      applicationCredentials: env.GOOGLE_APPLICATION_CREDENTIALS,
    },
  };
}
