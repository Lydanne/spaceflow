import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    root: "src",
    globals: true,
    environment: "node",
    include: ["**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["**/*.ts"],
      exclude: [
        "**/*.spec.ts",
        "**/*.module.ts",
        "**/index.ts",
        "**/__mocks__/**",
        "**/*.command.ts",
        "**/locales/**",
        "**/dto/**",
        "**/review-report/**",
        "**/review.mcp.ts",
        "**/review.config.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
