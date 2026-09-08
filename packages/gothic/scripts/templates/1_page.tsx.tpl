import { SignalReact } from "@hafley66/signals/react"
import type { PageSpec } from "../app/0_pages.js"
import { AlgoSection } from "../ui/4_Algo.js"
// scaffold:imports

const SIZES = [48, 96, 160, 320]
// scaffold:bindings

const NotebookPage = SignalReact(function NotebookPage() {
  return (
    <>
      {/* scaffold:sections */}
    </>
  )
})

export const PAGE: PageSpec = {
  id: "@@ID@@",
  title: "gothic: @@ID@@",
  path: "/@@ID@@",
  specs: {
    // scaffold:specs
  },
  Component: NotebookPage,
}
