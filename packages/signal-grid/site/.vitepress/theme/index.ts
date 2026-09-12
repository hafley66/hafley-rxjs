import { docsTheme, sinkOf } from "@hafley66/docs-kit/theme"
import { h } from "vue"
import * as signalGrid from "../../../src/index.js"
import { byId } from "../../../examples/index.js"
import { EMBEDS } from "../../embeds.js"
import { SECTIONS, STATS } from "../../stats.js"
import "../../../src/theme.css"
import "./site.css"
import ParityMatrix from "./ParityMatrix.vue"
import RouteFrame from "./RouteFrame.vue"

export default docsTheme({
  demos: { byId, evaluate: EMBEDS.evaluate, registry: "examples/index.ts" },
  stats: STATS,
  sections: SECTIONS,
  // The grid's own records arrive under `["signal-grid", stage]`, so the strip reads the stage.
  log: { sink: sinkOf(signalGrid), trim: ["signal-grid"], fallback: "grid" },
  demoComponent: "GridDemo",
  // Every showcase page embeds one route; the frame owns its own height and remembers it.
  components: { RouteFrame },
  docAfter: () => h(ParityMatrix),
})
