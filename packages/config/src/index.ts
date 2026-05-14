/**
 * @opsmind/config
 *
 * Central configuration package for OpsMind.
 * All configuration is validated at load time — the system refuses to boot with invalid config.
 *
 * Usage:
 *   import { loadEnv, getEnv, getDatabaseConfig, getAgentConfig, getCloudConfig } from '@opsmind/config'
 *
 *   // At application bootstrap:
 *   loadEnv()
 *
 *   // Anywhere after bootstrap:
 *   const env = getEnv()
 *   const dbConfig = getDatabaseConfig()
 */

// Environment
export { loadEnv, getEnv, resetEnv } from "../env/loader";
export { envSchema, type Env } from "../env/schema";

// Database
export {
  getDatabaseConfig,
  COLLECTION_NAMES,
  type DatabaseConfig,
  type CollectionName,
} from "../database/index";

// Agent
export {
  getAgentConfig,
  REASONING_STEPS,
  type AgentConfig,
  type ReasoningStep,
} from "../agent/index";

// Cloud
export {
  getCloudConfig,
  type CloudConfig,
  type GeminiConfig,
  type GoogleCloudConfig,
} from "../cloud/index";
