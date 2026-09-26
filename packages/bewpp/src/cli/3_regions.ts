import { byteLength } from "./0_estimate.js"
import { type Control, abbreviateTag, displayName, gradeControl } from "./0_grade.js"
import type { ClipResult, Region } from "./2_budget.js"

/** Same cap as a control's display name: the one length constant this tool defines. */
export const NAME_MAX_CHARS = 38
const CONTROLS_MARKER_SLACK = 24
const STRING_MARKER_SLACK = 8

function truncateToBytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return ""
  const buffer = Buffer.from(text, "utf8")
  if (buffer.length <= maxBytes) return text
  let end = maxBytes
  while (end > 0 && (buffer[end]! & 0xc0) === 0x80) end--
  return buffer.subarray(0, end).toString("utf8")
}

export function formatControlRow(control: Control, index: number): string {
  const grade = gradeControl(control)
  const tag = abbreviateTag(typeof control.tag === "string" ? control.tag : "")
  return ` ${grade}   ${tag}  #${index + 1}   ${displayName(control)}`
}

export const CONTROLS_TABLE_HEADER = "a11y tag  ref  name"

export type ControlsRegion = Region & { shown(): Control[]; withheldControls(): Control[] }

export function buildControlsRegion(controls: Control[], startIndex: number): ControlsRegion {
  const rows = controls.map((control, i) => formatControlRow(control, startIndex + i))
  const fullText = controls.length ? [CONTROLS_TABLE_HEADER, ...rows].join("\n") : CONTROLS_TABLE_HEADER
  const fullBytes = byteLength(fullText)
  let shownCount = controls.length
  return {
    key: "controls",
    weight: 3,
    fullBytes,
    render(maxBytes: number): ClipResult {
      if (controls.length === 0) {
        shownCount = 0
        return { text: CONTROLS_TABLE_HEADER, clipped: false, withheld: 0 }
      }
      if (maxBytes >= fullBytes) {
        shownCount = controls.length
        return { text: fullText, clipped: false, withheld: 0 }
      }
      const budget = Math.max(0, maxBytes - CONTROLS_MARKER_SLACK)
      const kept: string[] = []
      let used = byteLength(CONTROLS_TABLE_HEADER)
      for (const row of rows) {
        const cost = byteLength(row) + 1
        if (used + cost > budget) break
        kept.push(row)
        used += cost
      }
      shownCount = kept.length
      return { text: [CONTROLS_TABLE_HEADER, ...kept].join("\n"), clipped: true, withheld: rows.length - kept.length }
    },
    shown() {
      return controls.slice(0, shownCount)
    },
    withheldControls() {
      return controls.slice(shownCount)
    },
  }
}

export type StringRegion = Region & { shownChars(): number }

export function buildStringRegion(key: string, raw: string, collapse: boolean): StringRegion {
  const processed = collapse ? raw.replace(/\r?\n/g, "/") : raw
  const fullBytes = byteLength(processed)
  let shown = processed.length
  return {
    key,
    weight: 1,
    fullBytes,
    render(maxBytes: number): ClipResult {
      const budget = Math.max(0, maxBytes - STRING_MARKER_SLACK)
      if (maxBytes >= fullBytes) {
        shown = processed.length
        return { text: processed, clipped: false, withheld: 0 }
      }
      const text = truncateToBytes(processed, budget)
      shown = text.length
      return { text, clipped: true, withheld: processed.length - text.length }
    },
    shownChars() {
      return shown
    },
  }
}

export function truncateName(raw: string): { text: string; clipped: boolean; withheld: number } {
  const collapsed = raw.replace(/\s+/g, " ")
  if (collapsed.length <= NAME_MAX_CHARS) return { text: collapsed, clipped: false, withheld: 0 }
  return { text: collapsed.slice(0, NAME_MAX_CHARS), clipped: true, withheld: collapsed.length - NAME_MAX_CHARS }
}
