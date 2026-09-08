import { type AnySpec, useDrawIn, type ValuesOf } from "@hafley66/report-shell"
import { useRef } from "react"
import { fma2 } from "../algos/2_fma.js"
import type { PageSpec } from "../app/0_pages.js"
import { algoCtx } from "../kit/2_algo.js"
import { Section } from "../ui/2_Section.js"
import { AlgoSection, AlgoSvg } from "../ui/4_Algo.js"

const SIZES = [48, 96, 160, 240, 400]

const GALLERY = {
  seeds: { kind: "range", hint: "how many seeds to draw, 1..N", min: 4, max: 24, step: 1, default: 12 },
  size: { kind: "range", hint: "cell size in px", min: 96, max: 240, step: 8, default: 160, static: true },
  depth: { kind: "range", hint: "nesting depth for every cell", min: 1, max: 3, step: 1, default: 2 },
  sat: {
    kind: "range",
    hint: "satellite size as a fraction of the tangent radius",
    label: "satellite",
    min: 0.5,
    max: 1,
    step: 0.05,
    default: 0.9,
  },
  minPx: { kind: "range", hint: "smallest feature drawn, in px", min: 1, max: 6, step: 0.5, default: 2, static: true },
} as const satisfies AnySpec
type G = ValuesOf<typeof GALLERY>

// seeds 1..N with n and step from the seed: the family's variety at one size
function Gallery({ v }: { v: G }) {
  const ref = useRef<HTMLDivElement>(null)
  useDrawIn(ref, [JSON.stringify(v)])
  const cells = Array.from({ length: v.seeds }, (_, i) => {
    const p = { seed: i + 1, n: 0, step: 0, depth: v.depth, sat: v.sat, minPx: v.minPx, script: true, pupil: true }
    return { seed: i + 1, out: fma2.run(p, algoCtx(p, v.size)) }
  })
  return (
    <div ref={ref} className="row flex flex-wrap items-end gap-5">
      {cells.map(c => (
        <div key={c.seed} className="cell grid justify-items-center gap-1 text-[10px] text-muted">
          <AlgoSvg out={c.out} size={v.size} />
          <span>{`seed ${c.seed} · ${c.out.caption}`}</span>
        </div>
      ))}
    </div>
  )
}

function FmaPage() {
  return (
    <>
      <AlgoSection
        page="fma"
        algo={fma2}
        sizes={SIZES}
        title="fullmetal 2: one symmetry n drives script, star {n/k}, n nested satellites, chords, dual polygon, core"
      />
      <Section page="fma" def={{ id: "gallery", title: "gallery: seeds 1..N, n and k from the seed", spec: GALLERY }}>
        {v => <Gallery v={v as G} />}
      </Section>
    </>
  )
}

export const PAGE: PageSpec = {
  id: "fma",
  title: "gothic: fullmetal 2",
  path: "/fma",
  specs: { fma2: fma2.spec as unknown as AnySpec, gallery: GALLERY },
  Component: FmaPage,
}
