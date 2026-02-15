import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: "src",
    globals: true,
    environment: "node",
    include: ["**/*.spec.ts"],
    passWithNoTests: true,
  },
});
