import { docsTheme } from "@hafley66/docs-kit/theme"
import { createEmbeds } from "@hafley66/docs-kit"
import { STATS } from "../../stats.js"
import BoardDemo from "./BoardDemo.vue"
import "./board.css"

export default docsTheme({
  demos: { byId: () => undefined, evaluate: createEmbeds({}).evaluate, registry: "none yet" },
  stats: STATS,
  demoComponent: "GraphDemo",
  // The board, live: the page that documents it is also the page you drag it on.
  components: { BoardDemo },
})
