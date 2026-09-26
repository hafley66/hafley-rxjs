import { HandleAssigner } from "./0_handleLabel.js"
import { byteLength, estimateTokens } from "./0_estimate.js"
import { type Control, abbreviateTag, gradeControl, gradeCounts } from "./0_grade.js"
import { allocateBudget } from "./2_budget.js"
import { CONTROLS_TABLE_HEADER, NAME_MAX_CHARS, buildControlsRegion, buildStringRegion, truncateName } from "./3_regions.js"
import type { HandleTable, StoredRegion } from "./4_handleStore.js"

function footerLine(cmd: string, description: string): string {
  return `  ${cmd.padEnd(24)}${description}`
}

function stripScheme(url: string): string {
  return url.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "")
}

export type InspectInput = {
  tabId: number
  url: string
  title: string
  controls: Control[]
  text: string
  imageCount: number
  budget: number
  showNext: boolean
}

export type Rendered = { output: string; handleTable: HandleTable }

/** Fixed-point: the footer's own byte cost feeds back into the body split it also describes. */
export function renderInspect(input: InspectInput): Rendered {
  const byteBudget = input.budget * 4
  const counts = gradeCounts(input.controls)
  const urlLine = `@ ${stripScheme(input.url)}`
  const a11yLine = `a11y  + ${counts.plus}   ~ ${counts.tilde}   - ${counts.minus}`
  const name = truncateName(input.title)

  const assigner = new HandleAssigner()
  const regions: Record<string, StoredRegion> = {}
  let titleHandle: string | undefined
  if (name.clipped) {
    titleHandle = assigner.next()
    regions[titleHandle] = { kind: "title", tabId: input.tabId, title: input.title }
  }
  const titleLine = `# ${name.text}${titleHandle ? ` :-${titleHandle}` : ""}`
  const headerBytes = byteLength(urlLine) + 1 + byteLength(titleLine) + 1 + byteLength(a11yLine) + 1

  const controlsRegion = buildControlsRegion(input.controls, 0)
  const textRegion = buildStringRegion("text", input.text, true)

  let footerBytes = 0
  let footerText = ""
  let controlsResult = controlsRegion.render(controlsRegion.fullBytes)
  let textResult = textRegion.render(textRegion.fullBytes)
  let controlsHandle: string | undefined
  let textHandle: string | undefined

  for (let pass = 0; pass < 4; pass++) {
    const bodyAssigner = new HandleAssigner()
    if (titleHandle) bodyAssigner.next()
    const allocation = input.showNext
      ? allocateBudget(byteBudget - headerBytes, 0, footerBytes, [controlsRegion, textRegion])
      : allocateBudget(byteBudget - headerBytes, 0, 0, [controlsRegion, textRegion])
    controlsResult = allocation[0]!.result
    textResult = allocation[1]!.result
    controlsHandle = controlsResult.clipped ? bodyAssigner.next() : undefined
    textHandle = textResult.clipped ? bodyAssigner.next() : undefined
    if (!input.showNext) {
      footerText = ""
      break
    }
    const nextFooter = buildFooter({
      titleHandle,
      titleWithheldChars: name.withheld,
      controlsHandle,
      controlsWithheld: controlsResult.withheld,
      controlsGrade: controlsHandle ? gradeCounts(controlsRegion.withheldControls()).plus : 0,
      textHandle,
      textWithheldChars: textResult.withheld,
      shownControls: controlsRegion.shown(),
      imageCount: input.imageCount,
    })
    const nextBytes = byteLength(nextFooter)
    if (nextBytes === footerBytes) {
      footerText = nextFooter
      break
    }
    footerBytes = nextBytes
    footerText = nextFooter
  }

  if (controlsHandle) regions[controlsHandle] = { kind: "controls", tabId: input.tabId, controls: controlsRegion.withheldControls(), startIndex: controlsRegion.shown().length }
  if (textHandle) regions[textHandle] = { kind: "text", tabId: input.tabId, text: input.text }

  const lines = [urlLine, titleLine, a11yLine, "", controlsResult.text]
  if (controlsHandle) lines.push(`[${controlsResult.withheld} rows :-${controlsHandle}]`)
  lines.push("", `txt ${textResult.text}${textHandle ? ` :-${textHandle}` : ""}`)
  if (footerText) lines.push("", "next", footerText)
  const output = `${lines.join("\n")}\n`
  return { output, handleTable: { tabId: input.tabId, controlCount: input.controls.length, regions } }
}

function buildFooter(state: {
  titleHandle: string | undefined
  titleWithheldChars: number
  controlsHandle: string | undefined
  controlsWithheld: number
  controlsGrade: number
  textHandle: string | undefined
  textWithheldChars: number
  shownControls: Control[]
  imageCount: number
}): string {
  const lines: string[] = []
  if (state.titleHandle) {
    lines.push(footerLine(`bew x ${state.titleHandle}`, `${state.titleWithheldChars} more chars of title`))
  }
  if (state.controlsHandle) {
    lines.push(footerLine(`bew x ${state.controlsHandle}`, `${state.controlsWithheld} more controls`))
  }
  if (state.textHandle) {
    lines.push(footerLine(`bew x ${state.textHandle}`, `${state.textWithheldChars.toLocaleString("en-US")} chars of page text`))
  }
  if (state.controlsHandle) {
    lines.push(footerLine(`bew grep ${state.controlsHandle} <text>`, `filter region ${state.controlsHandle} by substring`))
    if (state.controlsGrade > 0)
      lines.push(footerLine(`bew x ${state.controlsHandle} --grade +`, `only the ${state.controlsGrade} a11y-clean controls`))
  }
  state.shownControls.forEach((control, index) => {
    const tag = abbreviateTag(typeof control.tag === "string" ? control.tag : "")
    if (tag !== "txa" && tag !== "inp") return
    const ref = index + 1
    lines.push(footerLine(`bew where #${ref}`, "selector path and ancestry for one ref"))
    lines.push(footerLine(`bew fill #${ref} "<text>"`, `${gradeControl(control)} inferred name, textbox`))
  })
  lines.push(footerLine("bew images", `page has ${state.imageCount} images >=256px`))
  return lines.join("\n")
}

export { stripScheme, footerLine, NAME_MAX_CHARS, CONTROLS_TABLE_HEADER }
export function tokensFor(bytes: number): number {
  return estimateTokens(bytes)
}
