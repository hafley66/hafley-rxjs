import { useEffect, useRef } from "react"
import type { PageSpec } from "../app/0_pages.js"
import type { AnySpec } from "../kit/0_spec.js"
import { BW, type Cell, G, bwCircle, bwShade, fanMosaic, islamic, mosaicRings } from "../lib/legacy/1_tiles.js"
import { stagger } from "../ui/0_hooks.js"
import { Section } from "../ui/2_Section.js"
import { Raw } from "../ui/5_Raw.js"

const BASE = {
  seed: { kind: "seed", default: 7 },
  density: { kind: "range", min: 4, max: 24, default: 10, label: "density px" },
  weight: { kind: "range", min: 0.5, max: 3, step: 0.25, default: 1, static: true },
  minPx: { kind: "range", min: 2, max: 24, default: 6, label: "min px", static: true },
  anim: { kind: "bool", default: false, label: "draw-in", static: true },
} as const satisfies AnySpec

const ISLAMIC = {
  ...BASE,
  lambda: { kind: "range", min: 1, max: 1.6, step: 0.02, default: 1.3, label: "lobe λ" },
} as const satisfies AnySpec
const MOSAIC = { ...BASE, noise: { kind: "range", min: 0, max: 1, step: 0.05, default: 0 } } as const satisfies AnySpec
const BLACKWORK = BASE

type Knobs = Record<string, unknown>
const apply = (v: Knobs) => {
  Object.assign(G, { sym: 0, intensity: 0.5, noise: 0, lambda: 1.3, ms: 1200 }, v)
}

function Cells({ cells, anim }: { cells: { name: string; cell: Cell }[]; anim: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (anim) stagger(host.current, "path, polyline, circle")
  })
  return (
    <div ref={host} className={`row flex flex-wrap items-end gap-5 ${anim ? "kit-draw" : ""}`}>
      {cells.map(({ name, cell }) => (
        <div key={name} className="cell grid justify-items-center gap-1 text-[10px] text-muted">
          <Raw html={cell.sc.svg(cell.box)} />
          <span>{name}</span>
        </div>
      ))}
    </div>
  )
}

const spread = (sizes: number[], makers: [string, (S: number) => Cell][]) =>
  sizes.flatMap(S =>
    makers.map(([name, fn]): { name: string; cell: Cell } => ({ name: `${name} ${S}px`, cell: fn(S) })),
  )

function Islamic({ v }: { v: Knobs }) {
  apply(v)
  return (
    <Cells
      anim={v.anim === true}
      cells={spread(
        [240, 120, 60],
        [
          ["square 45", S => islamic(S, "square", 45)],
          ["square 60", S => islamic(S, "square", 60)],
          ["square 72 tiles", S => islamic(S, "square", 72, { tiles: true })],
          ["hex 30", S => islamic(S, "hex", 30)],
          ["hex 45", S => islamic(S, "hex", 45)],
          ["hex 60", S => islamic(S, "hex", 60)],
          ["oct-square 45", S => islamic(S, "octsquare", 45)],
          ["oct-square 67", S => islamic(S, "octsquare", 67.5, { tiles: true })],
        ],
      )}
    />
  )
}

function Mosaic({ v }: { v: Knobs }) {
  apply(v)
  const density = Number(v.density)
  return (
    <Cells
      anim={v.anim === true}
      cells={spread(
        [240, 120, 60],
        [
          ["rings", S => mosaicRings(S)],
          ["rings dark .3", S => mosaicRings(S, { dark: 0.3, salt: 1 })],
          ["rings jitter", S => mosaicRings(S, { jitter: 1, salt: 2 })],
          ["rings fine", S => mosaicRings(S, { cell: density * 0.6, dark: 0.15, salt: 3 })],
          ["fans 4", S => fanMosaic(S)],
          ["fans 6", S => fanMosaic(S, { arcs: 6 })],
        ],
      )}
    />
  )
}

function Blackwork({ v }: { v: Knobs }) {
  apply(v)
  const makers: [string, (S: number) => Cell][] = Object.keys(BW).map(k => [k, (S: number) => bwCircle(S, k)])
  makers.push(
    ["shade lattice", S => bwShade(S, "lattice")],
    ["shade honeycomb", S => bwShade(S, "honeycomb")],
    ["shade wave", S => bwShade(S, "wave")],
  )
  return <Cells anim={v.anim === true} cells={spread([200, 100, 50], makers)} />
}

function TilesPage() {
  return (
    <>
      <Section
        page="tiles"
        def={{
          id: "islamic",
          title:
            "islamic star tilings: hankin's polygons in contact, rays at contact angle θ from edge midpoints, clipped to a roundel",
          spec: ISLAMIC,
        }}
      >
        {v => <Islamic v={v as Knobs} />}
      </Section>
      <Section
        page="tiles"
        def={{
          id: "mosaic",
          title: "mosaics: tesserae in rings (cell = density px), noise jitter, dark share; opus circumactum fans",
          spec: MOSAIC,
        }}
      >
        {v => <Mosaic v={v as Knobs} />}
      </Section>
      <Section
        page="tiles"
        def={{
          id: "blackwork",
          title:
            "blackwork: unit-cell line grammars as svg patterns, filled into circles and annuli; density shading by ring",
          spec: BLACKWORK,
        }}
      >
        {v => <Blackwork v={v as Knobs} />}
      </Section>
    </>
  )
}

export const PAGE: PageSpec = {
  id: "tiles",
  title: "gothic: islamic tilings, mosaics, blackwork",
  path: "/tiles",
  specs: { islamic: ISLAMIC, mosaic: MOSAIC, blackwork: BLACKWORK },
  Component: TilesPage,
}
