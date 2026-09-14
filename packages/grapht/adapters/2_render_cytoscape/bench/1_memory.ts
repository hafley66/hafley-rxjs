import { firstValueFrom } from "rxjs"
import { lag$ } from "../../../../trace/src/4_lag.ts"
import { memoryFixture } from "./0_fixture.ts"
const params = new URLSearchParams(location.search)
const mode = params.get("mode")
const host = document.querySelector<HTMLElement>("#host")!
const create = mode === "cytoscape"
  ? (await import("../6_graphRenderer.ts")).createCytoscapeGraphFrameResource
  : (await import("../8_documentRenderer.ts")).createDocumentGraphFrameResource
let frame: Awaited<ReturnType<typeof memoryFixture>> | undefined
let resource: ReturnType<typeof create> | undefined
Object.assign(window, { benchmark: {
  measureFrames() { return firstValueFrom(lag$("raf", 3000)) },
  async prepare() { frame = await memoryFixture(Number(params.get("copies"))) },
  mount() { resource = create(host, undefined, { inset: 44 }); resource.render(frame!, { enterIds: Object.keys(frame!.graph), updateIds: [], exitIds: [] }) },
  counts() { return { dom: host.querySelectorAll("*").length, graph: Object.keys(frame!.graph).length, edges: "cy" in resource! ? resource.cy.edges().length : 0 } },
  unsubscribe() { resource?.unsubscribe(); resource = undefined; frame = undefined; host.replaceChildren() },
} })
