import { config as loadDotenv } from "dotenv";
import { resolve } from "path";
import { envSchema, type Env } from "./schema";

let _env: Env | null = null;

/**
 * Loads and validates environment variables.
 * Throws at startup if required variables are missing or malformed.
 * Cached after first call — safe to call multiple times.
 */
export function loadEnv(): Env {
  if (_env !== null) return _env;

  // Load .env from monorepo root
  loadDotenv({ path: resolve(process.cwd(), "../../.env") });
  // Also try local .env
  loadDotenv({ path: resolve(process.cwd(), ".env"), override: false });

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `[OpsMind] Environment validation failed:\n${formatted}\n\nCheck your .env file.`
    );
  }

  _env = result.data;
  return _env;
}

/**
 * Returns the validated env — throws if loadEnv() was never called.
 * Use this in modules that are guaranteed to run after bootstrap.
 */
export function getEnv(): Env {
  if (_env === null) {
    throw new Error(
      "[OpsMind] Environment not loaded. Call loadEnv() during application bootstrap."
    );
  }
  return _env;
}

/**
 * Resets the cached env — only for use in tests.
 */
export function resetEnv(): void {
  _env = null;
}
