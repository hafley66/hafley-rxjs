import { FRACTALS } from "../algos/1_fractal.js"
import type { PageSpec } from "../app/0_pages.js"
import type { AnySpec } from "../kit/0_spec.js"
import { AlgoSection } from "../ui/4_Algo.js"

const SIZES = [48, 96, 160, 320]

function FractalPage() {
  return (
    <>
      {FRACTALS.map(a => (
        <AlgoSection key={a.name} page="fractal" algo={a as never} sizes={SIZES} />
      ))}
    </>
  )
}

export const PAGE: PageSpec = {
  id: "fractal",
  title: "gothic: fractal generators",
  path: "/fractal",
  specs: Object.fromEntries(FRACTALS.map(a => [a.name, a.spec as unknown as AnySpec])),
  Component: FractalPage,
}
