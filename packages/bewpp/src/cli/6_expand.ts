import { HandleAssigner } from "./0_handleLabel.js"
import { byteLength } from "./0_estimate.js"
import { type Control, gradeControl } from "./0_grade.js"
import { allocateBudget } from "./2_budget.js"
import { buildControlsRegion, buildStringRegion } from "./3_regions.js"
import type { HandleTable, StoredRegion } from "./4_handleStore.js"
import { footerLine } from "./5_render.js"

export type Rendered = { output: string; handleTable: HandleTable }

export function renderControlsBlock(controls: Control[], startIndex: number, tabId: number, budget: number, showNext: boolean, gradeFilter?: "+" | "~" | "-"): Rendered {
  const filtered = gradeFilter ? controls.filter(control => gradeControl(control) === gradeFilter) : controls
  const region = buildControlsRegion(filtered, startIndex)
  const byteBudget = budget * 4
  const regions: Record<string, StoredRegion> = {}
  let footerBytes = 0
  let footerText = ""
  let result = region.render(region.fullBytes)
  let handle: string | undefined
  for (let pass = 0; pass < 4; pass++) {
    const [allocated] = allocateBudget(byteBudget, 0, footerBytes, [region])
    result = allocated!.result
    handle = result.clipped ? new HandleAssigner().next() : undefined
    if (!showNext) {
      footerText = ""
      break
    }
    const nextFooter = handle
      ? [footerLine(`bew x ${handle}`, `${result.withheld} more controls`), footerLine(`bew grep ${handle} <text>`, `filter region ${handle} by substring`)].join("\n")
      : ""
    const nextBytes = byteLength(nextFooter)
    if (nextBytes === footerBytes) {
      footerText = nextFooter
      break
    }
    footerBytes = nextBytes
    footerText = nextFooter
  }
  if (handle) regions[handle] = { kind: "controls", tabId, controls: region.withheldControls(), startIndex: region.shown().length + startIndex }
  const lines = [result.text]
  if (handle) lines.push(`[${result.withheld} rows :-${handle}]`)
  if (footerText) lines.push("", "next", footerText)
  return { output: `${lines.join("\n")}\n`, handleTable: { tabId, regions } }
}

export function renderStringBlock(key: "text" | "title", text: string, tabId: number | null, budget: number, showNext: boolean): Rendered {
  const region = buildStringRegion(key, text, key === "text")
  const byteBudget = budget * 4
  const regions: Record<string, StoredRegion> = {}
  let footerBytes = 0
  let footerText = ""
  let result = region.render(region.fullBytes)
  let handle: string | undefined
  for (let pass = 0; pass < 4; pass++) {
    const [allocated] = allocateBudget(byteBudget, 0, footerBytes, [region])
    result = allocated!.result
    handle = result.clipped ? new HandleAssigner().next() : undefined
    if (!showNext) {
      footerText = ""
      break
    }
    const nextFooter = handle ? footerLine(`bew x ${handle}`, `${result.withheld.toLocaleString("en-US")} more chars`) : ""
    const nextBytes = byteLength(nextFooter)
    if (nextBytes === footerBytes) {
      footerText = nextFooter
      break
    }
    footerBytes = nextBytes
    footerText = nextFooter
  }
  if (handle && tabId !== null) regions[handle] = key === "text" ? { kind: "text", tabId, text } : { kind: "title", tabId, title: text }
  const lines = [`${key} ${result.text}${handle ? ` :-${handle}` : ""}`]
  if (footerText) lines.push("", "next", footerText)
  return { output: `${lines.join("\n")}\n`, handleTable: { tabId: tabId ?? undefined, regions } }
}

export function grepControls(controls: Control[], needle: string): Control[] {
  const lower = needle.toLowerCase()
  return controls.filter(control => JSON.stringify(control).toLowerCase().includes(lower))
}
