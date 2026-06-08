import { z } from "zod";

/**
 * Environment variable schema for OpsMind.
 * All variables are validated at startup — the system refuses to boot with invalid config.
 */
export const envSchema = z.object({
  // Runtime
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),

  // MongoDB
  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required")
    .startsWith("mongodb", "MONGODB_URI must be a valid MongoDB connection string"),
  MONGODB_DB_NAME: z.string().min(1).default("opsmind"),

  // Google Gemini / Vertex AI
  // Set USE_VERTEX_AI=true to use Vertex AI with ADC instead of API key
  USE_VERTEX_AI: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  // Required when USE_VERTEX_AI=false (Google AI Studio)
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-pro"),
  GEMINI_MAX_TOKENS: z.coerce.number().int().positive().default(8192),
  GEMINI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),

  // Google Cloud (required when USE_VERTEX_AI=true)
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GOOGLE_CLOUD_LOCATION: z.string().default("us-central1"),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  // Google Cloud Agent Builder (Discovery Engine)
  AGENT_BUILDER_PROJECT_ID: z.string().optional(),
  AGENT_BUILDER_LOCATION: z.string().default("global"),
  AGENT_BUILDER_COLLECTION: z.string().default("default_collection"),
  AGENT_BUILDER_ENGINE_ID: z.string().optional(),
  AGENT_BUILDER_SERVING_CONFIG: z.string().default("default_search"),

  // Agent Runtime
  AGENT_MAX_STEPS: z.coerce.number().int().positive().default(10),
  AGENT_REFLECTION_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("true"),
  AGENT_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
  AGENT_MEMORY_RETRIEVAL_LIMIT: z.coerce.number().int().positive().default(5),

  // API
  API_BASE_URL: z.string().url().default("http://localhost:3001"),
  WEB_BASE_URL: z.string().url().default("http://localhost:3000"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  // Vector Memory (optional — for semantic search)
  VECTOR_SEARCH_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  VECTOR_DIMENSIONS: z.coerce.number().int().positive().default(768),

  // MongoDB Atlas MCP Server (official MongoDB MCP integration)
  ATLAS_MCP_CLIENT_ID: z.string().optional(),
  ATLAS_MCP_CLIENT_SECRET: z.string().optional(),

  // Autonomous monitoring loop
  MONITORING_INTERVAL_MS: z.coerce.number().int().positive().optional(),

  // Google Cloud Pub/Sub (for real action execution)
  PUBSUB_TOPIC_ID: z.string().default("opsmind-alerts"),

  // GitLab MCP Integration (Official Partner)
  GITLAB_TOKEN: z.string().optional(),
  GITLAB_BASE_URL: z.string().url().default("https://gitlab.com/api/v4/mcp"),
  GITLAB_PROJECT_ID: z.string().optional(),

  // Voyage AI
  VOYAGE_API_KEY: z.string().optional(),
  VOYAGE_MODEL: z.string().default("voyage-3"),
});

export type Env = z.infer<typeof envSchema>;
