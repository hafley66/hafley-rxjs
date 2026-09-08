import type { PageSpec } from "../app/0_pages.js"
import { AlgoSection } from "../ui/4_Algo.js"
import { PAGE as BASE } from "./@@BASE@@.js"
// scaffold:imports

const SIZES = [48, 96, 160, 320]
const BaseBody = BASE.Component
// scaffold:bindings

const SPECS = {
  // scaffold:specs
}
for (const id of Object.keys(SPECS)) {
  if (id in BASE.specs || BASE.anchors?.includes(id)) throw new Error(`duplicate section: ${BASE.id}.${id}`)
}

function NotebookPage() {
  return (
    <>
      <BaseBody />
      {/* scaffold:sections */}
    </>
  )
}

export const PAGE: PageSpec = {
  ...BASE,
  specs: { ...BASE.specs, ...SPECS },
  Component: NotebookPage,
}
