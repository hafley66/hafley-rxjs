import type { PageSpec } from "../app/0_pages.js"
import { AlgoSection } from "../ui/4_Algo.js"
import { MovingAlgo } from "../ui/6_MovingAlgo.js"
import { ALGO as source_astrolabe } from "../algos/10_astrolabe.js"
import { ALGO as source_ossuary } from "../algos/11_ossuary.js"
import { ALGO as source_lithic } from "../algos/12_lithic.js"
// scaffold:imports

const SIZES = [256, 720]
const section_astrolabe = { ...source_astrolabe, name: "astrolabe" }
const section_ossuary = { ...source_ossuary, name: "ossuary" }
const section_lithic = { ...source_lithic, name: "lithic" }
// scaffold:bindings

function NotebookPage() {
  return (
    <>
      <MovingAlgo page="astrolabe" algo={section_astrolabe} title="Astrolabe Monstrance" subtitle="01 / brass, shadow, interference" gesture="scrub" duration={12} />
      <MovingAlgo page="astrolabe" algo={section_ossuary} title="Ribcage Cathedral" subtitle="02 / a breathing nave" gesture="view" duration={6} />
      <MovingAlgo page="astrolabe" algo={section_lithic} title="Mycelial Rose Window" subtitle="03 / from filament to limestone" gesture="seed" duration={16} loop={false} />
      {/* scaffold:sections */}
    </>
  )
}

export const PAGE: PageSpec = {
  id: "astrolabe",
  title: "gothic: living reliquaries",
  path: "/astrolabe",
  specs: {
    astrolabe: section_astrolabe.spec,
    ossuary: section_ossuary.spec,
    lithic: section_lithic.spec,
    // scaffold:specs
  },
  Component: NotebookPage,
}
