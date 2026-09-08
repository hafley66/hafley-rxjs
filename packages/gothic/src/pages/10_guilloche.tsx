import { SignalReact } from "@hafley66/signals/react"
import type { PageSpec } from "../app/0_pages.js"
import { AlgoSection } from "../ui/4_Algo.js"
import { ALGO as source_guilloche } from "../algos/3_guilloche.js"
// scaffold:imports

const SIZES = [128, 256, 512]
const section_guilloche = { ...source_guilloche, name: "guilloche" }
// scaffold:bindings

const NotebookPage = SignalReact(function NotebookPage() {
  return (
    <>
      <AlgoSection page="guilloche" algo={section_guilloche} sizes={SIZES} title="guilloché: woven rosettes" />
      {/* scaffold:sections */}
    </>
  )
})

export const PAGE: PageSpec = {
  id: "guilloche",
  title: "gothic: guilloché",
  path: "/guilloche",
  specs: {
    guilloche: section_guilloche.spec,
    // scaffold:specs
  },
  Component: NotebookPage,
}
