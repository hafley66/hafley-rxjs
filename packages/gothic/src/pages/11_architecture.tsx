import type { PageSpec } from "../app/0_pages.js"
import { AlgoSection } from "../ui/4_Algo.js"
import { ALGO as source_architecture } from "../algos/4_architecture.js"
import { ALGO as source_fanvault } from "../algos/5_fanvault.js"
import { ALGO as source_buttresses } from "../algos/6_buttresses.js"
import { ALGO as source_spires } from "../algos/7_spires.js"
import { ALGO as source_wheel } from "../algos/8_wheel.js"
import { ALGO as source_cloister } from "../algos/9_cloister.js"
// scaffold:imports

const SIZES = [160, 320, 480]
const section_architecture = { ...source_architecture, name: "architecture" }
const section_fanvault = { ...source_fanvault, name: "fanvault" }
const section_buttresses = { ...source_buttresses, name: "buttresses" }
const section_spires = { ...source_spires, name: "spires" }
const section_wheel = { ...source_wheel, name: "wheel" }
const section_cloister = { ...source_cloister, name: "cloister" }
// scaffold:bindings

function NotebookPage() {
  return (
    <>
      <AlgoSection page="architecture" algo={section_architecture} sizes={SIZES} title="branching lancet tracery" />
      <AlgoSection page="architecture" algo={section_fanvault} sizes={SIZES} title="fan vaults: ribs and star webs" />
      <AlgoSection page="architecture" algo={section_buttresses} sizes={SIZES} title="flying buttress forest" />
      <AlgoSection page="architecture" algo={section_spires} sizes={SIZES} title="crocketed spire clusters" />
      <AlgoSection page="architecture" algo={section_wheel} sizes={SIZES} title="radial lancet wheel windows" />
      <AlgoSection page="architecture" algo={section_cloister} sizes={SIZES} title="cloister enfilades" />
      {/* scaffold:sections */}
    </>
  )
}

export const PAGE: PageSpec = {
  id: "architecture",
  title: "gothic: architectural studies",
  path: "/architecture",
  specs: {
    architecture: section_architecture.spec,
    fanvault: section_fanvault.spec,
    buttresses: section_buttresses.spec,
    spires: section_spires.spec,
    wheel: section_wheel.spec,
    cloister: section_cloister.spec,
    // scaffold:specs
  },
  Component: NotebookPage,
}
