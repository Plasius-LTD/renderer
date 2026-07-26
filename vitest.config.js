import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/**/*.test.{ts,tsx}",
      "tests/**/*.tests.{ts,tsx}",
    ],
    passWithNoTests: true,
    coverage: {
      reporter: ["text", "json", "html", "lcov"],
      exclude: ["**/node_modules/**", "dist", "**/types/**"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
