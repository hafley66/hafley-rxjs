import { HandleAssigner } from "./0_handleLabel.js"
import { byteLength } from "./0_estimate.js"
import { allocateBudget } from "./2_budget.js"
import { buildStringRegion } from "./3_regions.js"
import type { HandleTable, StoredRegion } from "./4_handleStore.js"
import { footerLine } from "./5_render.js"

export type GenericInput = { tabId: number | null; value: unknown; budget: number; showNext: boolean }
export type Rendered = { output: string; handleTable: HandleTable }

/** One-region version of renderInspect's fixed point: no title/controls split, just a serialized value. */
export function renderGeneric(input: GenericInput): Rendered {
  const byteBudget = input.budget * 4
  const serialized = JSON.stringify(input.value, null, 1) ?? "null"
  const region = buildStringRegion("value", serialized, false)
  const regions: Record<string, StoredRegion> = {}

  let footerBytes = 0
  let footerText = ""
  let result = region.render(region.fullBytes)
  let handle: string | undefined

  for (let pass = 0; pass < 4; pass++) {
    const [allocated] = allocateBudget(byteBudget, 0, footerBytes, [region])
    result = allocated!.result
    const assigner = new HandleAssigner()
    handle = result.clipped ? assigner.next() : undefined
    if (!input.showNext) {
      footerText = ""
      break
    }
    const nextFooter = handle
      ? [
          footerLine(`bew x ${handle}`, `${result.withheld.toLocaleString("en-US")} more chars`),
          footerLine(`bew grep ${handle} <text>`, `filter region ${handle} by substring`),
        ].join("\n")
      : ""
    const nextBytes = byteLength(nextFooter)
    if (nextBytes === footerBytes) {
      footerText = nextFooter
      break
    }
    footerBytes = nextBytes
    footerText = nextFooter
  }

  if (handle) regions[handle] = { kind: "json", tabId: input.tabId, value: input.value }
  const lines = [result.text + (handle ? ` :-${handle}` : "")]
  if (footerText) lines.push("", "next", footerText)
  return { output: `${lines.join("\n")}\n`, handleTable: { tabId: input.tabId ?? undefined, regions } }
}
