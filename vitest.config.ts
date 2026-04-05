import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    // Prevent non-zero exit when no test files exist yet (initial project state)
    passWithNoTests: true,
  },
});
