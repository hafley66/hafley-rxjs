import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["examples/5_cross_language_logic/1_pipeline.test.ts"],
  },
});
