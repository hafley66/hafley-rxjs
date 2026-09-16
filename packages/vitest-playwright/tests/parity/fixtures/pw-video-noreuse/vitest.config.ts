import { vitestPlaywright } from "../../../../src/1_plugin.js"

export default {
  plugins: [
    vitestPlaywright({
      artifacts: { trace: "off", video: "on", outDir: "out/pw/video" },
      expect: { timeout: 2000 },
      // "worker" scope is the missing feature under test; the package type has no such value yet.
      contextScope: "worker" as any,
    }),
  ],
  test: { include: ["*.test.ts"] },
}