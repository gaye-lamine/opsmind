import { defineConfig } from "tsup";
import { resolve } from "path";

const root = resolve(__dirname, "../..");

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  outDir: "dist",
  /**
   * Bundle all @opsmind/* workspace packages into the output.
   * This produces a single self-contained binary that can be used
   * as a stdio MCP server by any MCP client (Claude Desktop, Cursor, etc.)
   */
  noExternal: [
    "@opsmind/config",
    "@opsmind/memory",
    "@opsmind/shared",
    "@opsmind/tools",
    "@opsmind/ai",
  ],
  external: [
    "mongodb",
    "zod",
    "@modelcontextprotocol/sdk",
    "crypto",
    "path",
    "fs",
    "os",
    "stream",
    "events",
  ],
  esbuildOptions(options) {
    options.alias = {
      "@opsmind/config": resolve(root, "packages/config/src/index.ts"),
      "@opsmind/memory": resolve(root, "packages/memory/src/index.ts"),
      "@opsmind/shared": resolve(root, "packages/shared/src/index.ts"),
      "@opsmind/tools":  resolve(root, "packages/tools/src/index.ts"),
      "@opsmind/ai":     resolve(root, "packages/ai/src/index.ts"),
    };
  },
  sourcemap: true,
  clean: true,
  target: "node20",
  platform: "node",
  /**
   * Inject the shebang so the binary is directly executable.
   */
  banner: {
    js: "#!/usr/bin/env node",
  },
});
