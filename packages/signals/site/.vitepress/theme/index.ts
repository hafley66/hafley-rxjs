import { docsTheme, sinkOf } from "@hafley66/docs-kit/theme"
import * as signals from "../../../src/index.js"
import { byId } from "../../../examples/index.js"
import { EMBEDS } from "../../embeds.js"
import { SECTIONS, STATS } from "../../stats.js"

export default docsTheme({
  demos: { byId, evaluate: EMBEDS.evaluate, registry: "examples/index.ts" },
  stats: STATS,
  sections: SECTIONS,
  // Records arrive under `["signals", step]`, so the strip reads the step.
  log: { sink: sinkOf(signals), trim: ["signals"], fallback: "signal" },
  demoComponent: "SignalDemo",
})
