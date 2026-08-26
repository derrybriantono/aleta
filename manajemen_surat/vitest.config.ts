import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    hookTimeout: 120000,
    testTimeout: 120000,
    environmentMatchGlobs: [
      ["src/test/backend-db.test.ts", "node"],
      ["src/test/institution-logo-background.test.ts", "node"],
    ],
    globals: true,
    setupFiles: [path.resolve(__dirname, "./src/test/setup.ts")],
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
