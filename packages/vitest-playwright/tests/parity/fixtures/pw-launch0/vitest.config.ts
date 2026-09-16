import { vitestPlaywright } from "../../../../src/1_plugin.js"

export default {
  plugins: [vitestPlaywright({ artifacts: { trace: "off" }, expect: { timeout: 2000 } })],
  test: { include: ["*.test.ts"], testTimeout: 1 },
}