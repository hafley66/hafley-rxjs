import { docsTheme } from "@hafley66/docs-kit/theme"
import { createEmbeds } from "@hafley66/docs-kit"
import { STATS } from "../../stats.js"

export default docsTheme({
  demos: { byId: () => undefined, evaluate: createEmbeds({}).evaluate, registry: "none yet" },
  stats: STATS,
  demoComponent: "GraphDemo",
})
