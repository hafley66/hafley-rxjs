import { vitestPlaywright } from "../../../../src/1_plugin.js"

export default {
  plugins: [
    vitestPlaywright({
      artifacts: { trace: "off" },
      expect: { timeout: 2000 },
      browser: { launch: { args: ["--pw-parity-launch-marker"] } },
    }),
  ],
  test: { include: ["*.test.ts"] },
}