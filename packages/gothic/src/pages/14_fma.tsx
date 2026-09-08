import type { PageSpec } from "../app/0_pages.js"
import { AlgoSection } from "../ui/4_Algo.js"
import { PAGE as BASE } from "./9_fma.js"
import { ALGO as source_envelope } from "../algos/13_envelope.js"
import { ALGO as source_braid } from "../algos/14_braid.js"
import { ALGO as source_conformal } from "../algos/15_conformal.js"
import { ALGO as source_cells } from "../algos/16_cells.js"
import { ALGO as source_resonance } from "../algos/17_resonance.js"
// scaffold:imports

const SIZES = [200, 400]
const BaseBody = BASE.Component
const section_envelope = { ...source_envelope, name: "envelope" }
const section_braid = { ...source_braid, name: "braid" }
const section_conformal = { ...source_conformal, name: "conformal" }
const section_cells = { ...source_cells, name: "cells" }
const section_resonance = { ...source_resonance, name: "resonance" }
// scaffold:bindings

const SPECS = {
  envelope: section_envelope.spec,
  braid: section_braid.spec,
  conformal: section_conformal.spec,
  cells: section_cells.spec,
  resonance: section_resonance.spec,
  // scaffold:specs
}
for (const id of Object.keys(SPECS)) {
  if (id in BASE.specs || BASE.anchors?.includes(id)) throw new Error(`duplicate section: ${BASE.id}.${id}`)
}

function NotebookPage() {
  return (
    <>
      <BaseBody />
      <AlgoSection page="fma" slice algo={section_envelope} sizes={SIZES} title="chord envelopes" />
      <AlgoSection page="fma" slice algo={section_braid} sizes={SIZES} title="interlaced ribbons" />
      <AlgoSection page="fma" slice algo={section_conformal} sizes={SIZES} title="conformal pole grid" />
      <AlgoSection page="fma" slice algo={section_cells} sizes={SIZES} title="crystalline transmutation plate" />
      <AlgoSection page="fma" slice algo={section_resonance} sizes={SIZES} title="standing-wave inscriptions" />
      {/* scaffold:sections */}
    </>
  )
}

export const PAGE: PageSpec = {
  ...BASE,
  specs: { ...BASE.specs, ...SPECS },
  Component: NotebookPage,
}
