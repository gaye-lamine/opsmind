import { defineConfig } from "tsup";
import { resolve } from "path";

const root = resolve(__dirname, "../..");

export default defineConfig({
  entry: ["src/server/index.ts"],
  format: ["cjs"],
  outDir: "dist",
  noExternal: [
    "@opsmind/agent",
    "@opsmind/ai",
    "@opsmind/config",
    "@opsmind/mcp-client",
    "@opsmind/memory",
    "@opsmind/shared",
    "@opsmind/tools",
  ],
  external: [
    "mongodb",
    "express",
    "cors",
    "zod",
    "@google/generative-ai",
    "@modelcontextprotocol/sdk",
    "crypto",
    "path",
    "fs",
    "os",
    "stream",
    "events",
    "child_process",
  ],
  esbuildOptions(options) {
    options.alias = {
      "@opsmind/agent":      resolve(root, "packages/agent/src/index.ts"),
      "@opsmind/ai":         resolve(root, "packages/ai/src/index.ts"),
      "@opsmind/config":     resolve(root, "packages/config/src/index.ts"),
      "@opsmind/mcp-client": resolve(root, "packages/mcp-client/src/index.ts"),
      "@opsmind/memory":     resolve(root, "packages/memory/src/index.ts"),
      "@opsmind/shared":     resolve(root, "packages/shared/src/index.ts"),
      "@opsmind/tools":      resolve(root, "packages/tools/src/index.ts"),
    };
  },
  sourcemap: true,
  clean: true,
  target: "node20",
  platform: "node",
});
