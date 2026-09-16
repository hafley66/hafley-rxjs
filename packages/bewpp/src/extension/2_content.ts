import { onMessage, sendMessage } from "./0_messaging.js"
import { executeDom } from "./1_dom.js"

declare const __BEWPP_BUILD__: string
const state = globalThis as typeof globalThis & { bewppBuild?: string }
if (state.bewppBuild !== __BEWPP_BUILD__) {
  state.bewppBuild = __BEWPP_BUILD__
  onMessage("dom", ({ data }) => executeDom(data))
}
void sendMessage("ready").catch(() => {})
