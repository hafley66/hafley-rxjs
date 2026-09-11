// Signals measures nothing the kit does not already measure, so this binds the generated file to
// the kit's own sections and adds none of its own.
import { CORE_SECTIONS, demoMemoryNodes, type SectionBuilder, type Stats } from "@hafley66/docs-kit"
import raw from "./stats.json"

// The import is a JSON literal, so TypeScript would infer `null` for whichever optional field
// happens to be null in today's file. The declared shape is the contract stats.mjs writes to.
export const STATS = raw as unknown as Stats

const demos = (stats: Stats) => ({
  id: "demos",
  title: "Demos",
  nodes: demoMemoryNodes(stats, "readouts"),
})

export const SECTIONS: Readonly<Record<string, SectionBuilder>> = { ...CORE_SECTIONS, demos }
