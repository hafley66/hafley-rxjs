import type { AnySpec } from "@hafley66/report-shell"
import { useEffect, useRef } from "react"
import type { PageSpec } from "../app/0_pages.js"
import type { SectionState } from "../app/2_state.js"
import {
  type Cell,
  diagramCell,
  flower,
  fma,
  G,
  metatron,
  morph,
  mulberry32,
  randomSpec,
  Spec,
  spiroCell,
  vesicaLattice,
} from "../lib/legacy/0_circles.js"
import { stagger } from "../ui/0_hooks.js"
import { Section } from "../ui/2_Section.js"
import { Raw } from "../ui/5_Raw.js"

const SHARED = {
  seed: { kind: "seed", hint: "seed for every seal and diagram in the section", default: 7 },
  sym: {
    kind: "range",
    hint: "forced rotational symmetry n; 0 = the seed picks",
    min: 0,
    max: 12,
    default: 0,
    label: "sym n",
  },
  intensity: {
    kind: "range",
    hint: "ornament bands per seal: 0 = bare ring, 1 = every band",
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.5,
  },
  lambda: {
    kind: "range",
    hint: "lobe stretch for foil arcs: 1 = semicircle, 1.6 = tall pointed lobe",
    min: 1,
    max: 1.6,
    step: 0.02,
    default: 1.3,
    label: "lobe λ",
  },
  minPx: {
    kind: "range",
    hint: "smallest feature drawn, in px; bands and lobes under it are dropped (LOD)",
    min: 2,
    max: 24,
    default: 6,
    label: "min px",
    static: true,
  },
  weight: {
    kind: "range",
    hint: "stroke width multiplier for every path in the section",
    min: 0.5,
    max: 3,
    step: 0.25,
    default: 1,
    static: true,
  },
  anim: {
    kind: "bool",
    hint: "draw paths in along their length on every rerender",
    default: false,
    label: "draw-in",
    static: true,
  },
} as const satisfies AnySpec

const DIAGRAM = {
  ...SHARED,
  spec: {
    kind: "text",
    hint: "seal spec as JSON; empty = the seeded spec. Edit it to hand-compose a seal",
    default: "",
    size: 60,
    label: "spec json",
    shuffle: false,
  },
  ms: {
    kind: "range",
    hint: "draw-in time for the diagram, in ms",
    min: 200,
    max: 4000,
    step: 100,
    default: 1200,
    static: true,
  },
} as const satisfies AnySpec
const FMA = SHARED
const SACRED = {
  seed: SHARED.seed,
  lambda: SHARED.lambda,
  minPx: SHARED.minPx,
  weight: SHARED.weight,
  anim: SHARED.anim,
} as const satisfies AnySpec

type Knobs = Record<string, unknown>
const apply = (v: Knobs) => {
  Object.assign(G, { noise: 0, density: 10, ms: 1200 }, v)
}

function Cells({
  cells,
  anim,
  morphable = false,
}: {
  cells: { name: string; cell: Cell }[]
  anim: boolean
  morphable?: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const prev = useRef<string[]>([])
  useEffect(() => {
    if (anim) stagger(host.current, "path, polyline, circle")
    const svgs = [...(host.current?.querySelectorAll("svg") ?? [])]
    if (morphable && anim)
      svgs.forEach((svg, i) => {
        const old = prev.current[i]
        if (!old) return
        const tmp = document.createElement("div")
        tmp.innerHTML = old
        if (tmp.firstElementChild) morph(tmp.firstElementChild, svg, G.ms)
      })
    prev.current = svgs.map(s => s.outerHTML)
  })
  return (
    <div ref={host} className={`row flex flex-wrap items-end gap-5 ${anim ? "kit-draw" : ""}`}>
      {cells.map(({ name, cell }) => (
        <div key={name} className="cell cell-unit grid justify-items-center gap-1 text-[10px] text-muted">
          <Raw html={cell.sc.svg(cell.box)} />
          <span>{name}</span>
        </div>
      ))}
    </div>
  )
}

function Diagram({ v, state }: { v: Knobs; state: SectionState<AnySpec> }) {
  apply(v)
  const seed = Number(v.seed)
  const text = String(v.spec ?? "")
  let parsed: unknown = null
  let error = ""
  try {
    parsed = text.trim() ? Spec.parse(JSON.parse(text)) : randomSpec(mulberry32(seed))
  } catch (e) {
    const err = e as { issues?: { path: (string | number)[]; message: string }[]; message?: string }
    error = err.issues ? err.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("\n") : String(err.message)
  }
  const cells = parsed
    ? [480, 240, 120].map(S => ({ name: `spec ${S}px seed ${seed}`, cell: diagramCell(S, parsed, seed) }))
    : []
  const btn = "rounded-sm border border-edge px-1.5 py-px text-fg hover:border-ink"
  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <textarea
          className="h-24 w-[46rem] rounded-sm border border-edge bg-well p-2 font-mono text-[11px] text-fg"
          value={text}
          onChange={e => state.set({ spec: e.currentTarget.value }, "replace")}
          placeholder="{} — empty means the seeded transmutation spec"
        />
        <span className="grid gap-1">
          <button
            type="button"
            className={btn}
            onClick={() =>
              state.set(
                { spec: JSON.stringify(randomSpec(mulberry32((seed * 7 + Date.now()) >>> 0)), null, 1) },
                "push",
              )
            }
          >
            load a random transmutation spec
          </button>
          <button type="button" className={btn} onClick={() => state.set({ seed: seed + 1 }, "push")}>
            morph to next seed
          </button>
          <span className="whitespace-pre font-mono text-[10px] text-[oklch(70%_0.15_25)]">{error}</span>
        </span>
      </div>
      <Cells cells={cells} anim={v.anim === true} morphable />
    </>
  )
}

function Fma({ v }: { v: Knobs }) {
  apply(v)
  const rows: { name: string; cell: Cell }[] = []
  for (const S of [360, 180, 90]) {
    for (const n of [3, 4, 5, 6, 7, 8]) rows.push({ name: `fma n=${n} ${S}px`, cell: fma(S, { n, salt: n }) })
    rows.push({ name: `fma dense ${S}px`, cell: fma(S, { intensity: 1, salt: 11 }) })
    rows.push({ name: `fma sparse ${S}px`, cell: fma(S, { intensity: 0, salt: 12 }) })
    rows.push({ name: `fma sliders ${S}px`, cell: fma(S, { salt: 13 }) })
  }
  return <Cells cells={rows} anim={v.anim === true} />
}

function Sacred({ v }: { v: Knobs }) {
  apply(v)
  const makers: [string, (S: number) => Cell][] = [
    ["flower 1", S => flower(S, 1)],
    ["flower 2", S => flower(S, 2)],
    ["flower 3", S => flower(S, 3)],
    ["metatron", S => metatron(S)],
    ["vesica 3", S => vesicaLattice(S, 3)],
    ["vesica 6", S => vesicaLattice(S, 6)],
    ["spiro 5/3", S => spiroCell(S, 5, 3, 0.8)],
    ["spiro 7/2", S => spiroCell(S, 7, 2, 0.6)],
    ["spiro 9/4", S => spiroCell(S, 9, 4, 1)],
    ["spiro 11/3", S => spiroCell(S, 11, 3, 0.35)],
  ]
  const rows = [240, 120, 60].flatMap(S => makers.map(([name, fn]) => ({ name: `${name} ${S}px`, cell: fn(S) })))
  return <Cells cells={rows} anim={v.anim === true} />
}

function CirclesPage() {
  return (
    <>
      <Section
        page="circles"
        def={{
          id: "diagram",
          title:
            "ring diagram editor: bands get radii by weight, n slots per band, kinds compose; zod validates, seed change morphs matching paths",
          spec: DIAGRAM,
        }}
      >
        {(v, ctx) => <Diagram v={v as Knobs} state={ctx.state} />}
      </Section>
      <Section
        page="circles"
        def={{
          id: "fma",
          title:
            "transmutation circles: seeded compositor over the ring layout (runes on textPath, polygons, nodes, chords, sub-circles, ticks)",
          spec: FMA,
        }}
      >
        {v => <Fma v={v as Knobs} />}
      </Section>
      <Section
        page="circles"
        def={{
          id: "sacred",
          title: "sacred geometry: flower of life, seed, metatron's cube, vesica lattice, spirographs",
          spec: SACRED,
        }}
      >
        {v => <Sacred v={v as Knobs} />}
      </Section>
    </>
  )
}

export const PAGE: PageSpec = {
  id: "circles",
  title: "gothic: ring layouts, transmutation circles",
  path: "/circles",
  specs: { diagram: DIAGRAM, fma: FMA, sacred: SACRED },
  Component: CirclesPage,
}
