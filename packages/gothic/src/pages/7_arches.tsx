import { SignalReact } from "@hafley66/signals/react"
import type { ReactNode } from "react"
import type { PageSpec } from "../app/0_pages.js"
import { sectionState } from "../app/2_state.js"
import type { AnySpec } from "../kit/0_spec.js"
import { SIZES, axes, cell, families, global as archGlobal } from "../lib/legacy/2_arches.js"
import {
  band,
  base,
  boss,
  capital,
  corbel,
  crocketsOf,
  facade,
  finialOf,
  fleuron,
  flyingButtress,
  grammar,
  grammar2,
  head,
  hoodMould,
  mouchette,
  panelTracery,
  pinnacle,
  ring,
  rose,
  soufflet,
  vault,
  vesica,
} from "../lib/legacy/3_buildings.js"
import { PlainSection, Section } from "../ui/2_Section.js"
import { Raw } from "../ui/5_Raw.js"

/* ============ the page globals: the old #ctl bar, now the families section's own spec ============ */
const GLOBALS = {
  seed: { kind: "seed", default: 7 },
  legs: { kind: "range", min: 0, max: 1.5, step: 0.1, default: 0.6 },
  lambda: { kind: "range", min: 1, max: 1.6, step: 0.02, default: 1.3, label: "lobe λ" },
  lobe: { kind: "select", options: ["round", "pointed", "dagger", "eyelet"], default: "round" },
  noise: { kind: "range", min: 0, max: 1, step: 0.05, default: 0 },
  asym: { kind: "range", min: 0, max: 1, step: 0.05, default: 0 },
  intensity: { kind: "range", min: 0, max: 1, step: 0.05, default: 0 },
  minLobe: { kind: "range", min: 2, max: 24, default: 7, label: "min lobe px", static: true },
  minSub: { kind: "range", min: 8, max: 64, step: 2, default: 22, label: "min sub-arch px", static: true },
  weight: { kind: "range", min: 0.5, max: 3, step: 0.25, default: 1, static: true },
  guides: { kind: "bool", default: false, label: "show guides", static: true },
} as const satisfies AnySpec

const SPREAD = {
  axis: { kind: "select", options: Object.keys(axes), default: "k" },
  lo: { kind: "number", default: 0, step: 0.1, label: "from" },
  hi: { kind: "number", default: 2, step: 0.1, label: "to" },
  m: { kind: "range", min: 2, max: 16, default: 7, label: "m steps" },
  n: { kind: "range", min: 1, max: 10, default: 6, label: "n sizes" },
  big: { kind: "number", default: 256, step: 16, label: "big px", static: true },
  small: { kind: "number", default: 16, step: 4, label: "small px", static: true },
  base: { kind: "select", options: Object.keys(families), default: "equilateral" },
} as const satisfies AnySpec

const LOBES = {
  shape: { kind: "select", options: ["all", "round", "pointed", "dagger", "eyelet"], default: "all" },
  lancet: { kind: "range", min: 1, max: 3.5, step: 0.1, default: 2.2 },
} as const satisfies AnySpec
const ANATOMY = { big: { kind: "range", min: 80, max: 320, step: 40, default: 160 } } as const satisfies AnySpec
const ROSE = {
  spokes: { kind: "range", min: 4, max: 24, default: 8 },
  rings: { kind: "range", min: 1, max: 5, default: 3 },
  k: { kind: "range", min: 0, max: 2.5, step: 0.1, default: 1 },
  eye: { kind: "range", min: 0.05, max: 0.4, step: 0.01, default: 0.2 },
  twist: { kind: "range", min: 0, max: 0.4, step: 0.02, default: 0 },
  foils: { kind: "range", min: 0, max: 6, default: 0 },
  depth: { kind: "range", min: 0, max: 2, default: 0 },
} as const satisfies AnySpec
const PANEL = {
  cols: { kind: "range", min: 1, max: 8, default: 4 },
  rows: { kind: "range", min: 1, max: 4, default: 2 },
  k: { kind: "range", min: 0.1, max: 1.5, step: 0.05, default: 0.35 },
  foils: { kind: "range", min: 0, max: 6, default: 3 },
  levels: { kind: "range", min: 1, max: 4, default: 2 },
} as const satisfies AnySpec

const GRID = [320, 160, 80, 40]
type Knobs = Record<string, unknown>
type Made = { name: string; html: string }
type Cellish = { sc: { svg(box: number[]): string }; box: number[] }

// the arch grammar reads one mutable globals object; the families bar owns it and every section tracks it
function useGlobals(): Knobs {
  const g = sectionState("arches", "families", GLOBALS).values.$()
  Object.assign(archGlobal, g)
  return g as Knobs
}

function Cells({ cells }: { cells: Made[] }): ReactNode {
  return (
    <div className="row flex flex-wrap items-end gap-5">
      {cells.map(c => (
        <div key={c.name} className="cell grid justify-items-center gap-1 text-[10px] text-muted">
          <Raw html={c.html} />
          <span>{c.name}</span>
        </div>
      ))}
    </div>
  )
}

const gen = (sizes: number[], makers: [string, (S: number) => Cellish][]): Made[] =>
  sizes.flatMap(S =>
    makers.map(([name, fn]) => {
      const c = fn(S)
      return { name: `${name} ${S}px`, html: c.sc.svg(c.box) }
    }),
  )

const archCells = (sizes: number[], makers: [string, Knobs][]): Made[] =>
  sizes.flatMap(S =>
    makers.map(([name, spec]) => {
      const r = cell({ ...archGlobal, ...spec }, S)
      return { name: [`${name} ${S}px`, ...r.lod].join(" "), html: r.svg.outerHTML }
    }),
  )

const Families = SignalReact(function Families() {
  useGlobals()
  return <Cells cells={archCells(SIZES, Object.entries(families) as [string, Knobs][])} />
})

const Spread = SignalReact(function Spread({ v }: { v: Knobs }) {
  useGlobals()
  const axis = String(v.axis)
  const lo = Number(v.lo)
  const hi = Number(v.hi)
  const m = Number(v.m)
  const n = Number(v.n)
  const big = Number(v.big)
  const small = Number(v.small)
  const base = families[String(v.base)]
  const cells: Made[] = []
  for (let i = 0; i < n; i++) {
    const px = n === 1 ? big : big * (small / big) ** (i / (n - 1))
    for (let j = 0; j < m; j++) {
      let val = lo + (hi - lo) * (m === 1 ? 0 : j / (m - 1))
      if (axis === "foils" || axis === "depth") val = Math.round(val)
      const r = cell({ ...archGlobal, ...base, [axis]: val }, px)
      cells.push({
        name: [`${axis}=${Math.round(val * 1000) / 1000} ${Math.round(px)}px`, ...r.lod].join(" "),
        html: r.svg.outerHTML,
      })
    }
  }
  return <Cells cells={cells} />
})

const Lobes = SignalReact(function Lobes({ v }: { v: Knobs }) {
  useGlobals()
  const shapes = v.shape === "all" ? ["round", "pointed", "dagger", "eyelet"] : [String(v.shape)]
  const lancet = Number(v.lancet)
  const makers: [string, (S: number) => Cellish][] = []
  for (const shape of shapes) {
    for (const n of [3, 4, 5, 6, 8]) makers.push([`${shape} ${n}`, S => ring(S, n, shape)])
    for (const n of [3, 5]) makers.push([`${shape} head ${n}`, S => head(S, n, shape)])
    for (const n of [3, 5]) makers.push([`${shape} lancet ${n}`, S => head(S, n, shape, lancet)])
  }
  return <Cells cells={gen([160, 80, 40], makers)} />
})

const Anatomy = SignalReact(function Anatomy({ v }: { v: Knobs }) {
  useGlobals()
  const big = Number(v.big)
  const makers: [string, (S: number) => Cellish][] = [
    ["capital plain", S => capital(S)],
    ["capital crocket", S => capital(S, { crockets: true })],
    ["capital stiff-leaf", S => capital(S, { leaves: true })],
    ["base", S => base(S)],
    ["corbel", S => corbel(S)],
    ["corbel foiled", S => corbel(S, { head: true })],
    ["boss 4", S => boss(S)],
    ["boss 6", S => boss(S, { n: 6 })],
    ["hood mould", S => hoodMould(S)],
    ["hood mould trefoil", S => hoodMould(S, { foils: 3 })],
    ["finial fleur", S => finialOf(S, "fleur")],
    ["finial cross", S => finialOf(S, "cross")],
    ["finial pommel", S => finialOf(S, "pommel")],
    ["finial bud", S => finialOf(S, "bud")],
    ["crockets curl", S => crocketsOf(S, "curl")],
    ["crockets leaf", S => crocketsOf(S, "leaf")],
    ["crockets bud", S => crocketsOf(S, "bud")],
    ["crockets ballflower", S => crocketsOf(S, "ballflower")],
    ["fleuron 4", S => fleuron(S)],
    ["fleuron 6", S => fleuron(S, { n: 6 })],
  ]
  return <Cells cells={gen([big, big / 2, big / 4], makers)} />
})

const Rose = SignalReact(function Rose({ v }: { v: Knobs }) {
  useGlobals()
  const makers: [string, (S: number) => Cellish][] = [
    ["rose 8·3", S => rose(S, { spokes: 8, rings: 3 })],
    ["rose 6·2 foiled", S => rose(S, { spokes: 6, rings: 2, foils: 3 })],
    ["rose 12·3 lancet", S => rose(S, { spokes: 12, rings: 3, k: 2 })],
    ["rose 8·4 traceried", S => rose(S, { spokes: 8, rings: 4, depth: 1, eye: 0.12 })],
    ["wheel 16·1", S => rose(S, { spokes: 16, rings: 1, k: 0, eye: 0.3 })],
    ["rose sliders", S => rose(S, v)],
  ]
  return <Cells cells={gen(GRID, makers)} />
})

const Panel = SignalReact(function Panel({ v }: { v: Knobs }) {
  useGlobals()
  const makers: [string, (S: number) => Cellish][] = [
    ["perp 4×2", S => panelTracery(S, { cols: 4, rows: 2 })],
    ["perp 6×3 flat", S => panelTracery(S, { cols: 6, rows: 3, k: 0.2, body: S * 1.2 })],
    ["perp 2×1 tall", S => panelTracery(S, { cols: 2, rows: 1, k: 1, body: S * 1.3, levels: 4 })],
    ["perp 8×2 plain", S => panelTracery(S, { cols: 8, rows: 2, foils: 0 })],
    ["perp sliders", S => panelTracery(S, v)],
  ]
  return <Cells cells={gen(GRID, makers)} />
})

/* ============ the tail: the same generators without their own bars, on the families globals ============ */
const Tail = SignalReact(function Tail({
  makers,
  sizes,
}: {
  makers: [string, (S: number) => Cellish][]
  sizes: number[]
}) {
  useGlobals()
  return <Cells cells={gen(sizes, makers)} />
})

const NoisyTail = SignalReact(function NoisyTail() {
  useGlobals()
  const cells = [
    ...archCells(
      [320, 160, 80],
      [
        ["tracery d3", { k: 1, depth: 3 }],
        ["tracery d3 lancet", { k: 1.6, depth: 3 }],
        ["tracery d4 foiled", { k: 1, depth: 4, foils: 3 }],
      ],
    ),
    ...gen(
      [320, 160, 80],
      [
        ["rose 8·3", S => rose(S, { spokes: 8, rings: 3 })],
        ["rose 6·3", S => rose(S, { spokes: 6, rings: 3, k: 1.5 })],
      ],
    ),
  ]
  return <Cells cells={cells} />
})

function ArchesPage() {
  return (
    <>
      <Section
        page="arches"
        def={{ id: "families", title: "families × size (this bar is the page's arch globals)", spec: GLOBALS }}
      >
        {() => <Families />}
      </Section>
      <Section page="arches" def={{ id: "spread", title: "spread: one parameter × n sizes", spec: SPREAD }}>
        {v => <Spread v={v as Knobs} />}
      </Section>
      <Section
        page="arches"
        def={{ id: "lobes", title: "lobes: foil rings and cusped heads by lobe shape and count", spec: LOBES }}
      >
        {v => <Lobes v={v as Knobs} />}
      </Section>
      <Section
        page="arches"
        def={{
          id: "anatomy",
          title: "anatomy: capital, base, corbel, boss, hood mould, finials, crockets, ballflower, fleuron",
          spec: ANATOMY,
        }}
      >
        {v => <Anatomy v={v as Knobs} />}
      </Section>
      <Section
        page="arches"
        def={{ id: "rose", title: "rose windows: radial subdivision, spokes double per ring", spec: ROSE }}
      >
        {v => <Rose v={v as Knobs} />}
      </Section>
      <Section
        page="arches"
        def={{ id: "panel", title: "perpendicular panel tracery: mullion grid, cusped panel heads", spec: PANEL }}
      >
        {v => <Panel v={v as Knobs} />}
      </Section>

      <PlainSection id="flamboyant" title="flamboyant pieces: vesica (recursive), soufflet (4 ogee heads), mouchette">
        <Tail
          sizes={GRID}
          makers={[
            ["vesica d2", S => vesica(S, { depth: 2 })],
            ["vesica d3 cinq", S => vesica(S, { depth: 3, foils: 5 })],
            ["soufflet", S => soufflet(S)],
            ["soufflet sharp", S => soufflet(S, { k: 1.6, ogee: 0.3 })],
            ["mouchette", S => mouchette(S)],
          ]}
        />
      </PlainSection>
      <PlainSection
        id="pinnacle"
        title="pinnacle: shaft, gablet, crocketed spire, finial; child pinnacles at .45 scale"
      >
        <Tail
          sizes={GRID}
          makers={[
            ["pinnacle d0", S => pinnacle(S, { depth: 0 })],
            ["pinnacle d1", S => pinnacle(S, { depth: 1 })],
            ["pinnacle d2", S => pinnacle(S, { depth: 2 })],
            ["spire dense crockets", S => pinnacle(S, { depth: 1, crocket: S * 0.05 })],
          ]}
        />
      </PlainSection>
      <PlainSection id="vault" title="vault plans: quadripartite, sexpartite, tierceron, lierne star, fan">
        <Tail
          sizes={GRID}
          makers={[
            ["quadripartite", S => vault(S, { type: "quadripartite" })],
            ["sexpartite", S => vault(S, { type: "sexpartite", aspect: 1.1 })],
            ["tierceron", S => vault(S, { type: "tierceron" })],
            ["lierne star", S => vault(S, { type: "lierne" })],
            ["fan 3·3", S => vault(S, { type: "fan" })],
            ["fan 4·4 square", S => vault(S, { type: "fan", aspect: 1, ribs: 4, rings: 4 })],
          ]}
        />
      </PlainSection>
      <PlainSection
        id="buttress"
        title="flying buttress: stepped pier, two flyers, arcade between rails, pinnacle on the pier"
      >
        <Tail
          sizes={GRID}
          makers={[
            ["flyers 2", S => flyingButtress(S, { tiers: 2 })],
            ["flyers 1", S => flyingButtress(S, { tiers: 1 })],
          ]}
        />
      </PlainSection>
      <PlainSection id="bands" title="bands: crenellation, blind arcade, quatrefoil diaper, dogtooth, billet">
        <Tail
          sizes={[480, 240, 120, 60]}
          makers={["crenellation", "arcade", "diaper", "dogtooth", "billet"].map(t => [t, (S: number) => band(S, t)])}
        />
      </PlainSection>
      <PlainSection id="facade" title="facade layout: towers | nave, three tiers, role by cell aspect">
        <Tail sizes={[560, 280, 140, 70]} makers={[["west front", S => facade(S)]]} />
      </PlainSection>
      <PlainSection id="noisy" title="noise: seeded value noise jitters k and foils per tracery node and per rose ring">
        <NoisyTail />
      </PlainSection>
      <PlainSection
        id="grammar"
        title="grammar: seeded S-curve tracery, mirror symmetry, branches shrink .62, clipped to the head"
      >
        <Tail
          sizes={[320, 160, 80]}
          makers={[
            ["grammar d3", S => grammar(S)],
            ["grammar d4", S => grammar(S, { depth: 4, salt: 1 })],
            ["grammar sharp", S => grammar(S, { depth: 3, angle: 60, bend: 1.1, salt: 2 })],
            ["grammar lancet d4", S => grammar(S, { depth: 4, k: 2, salt: 3 })],
            ["grammar soft", S => grammar(S, { depth: 4, angle: 30, bend: 0.5, shrink: 0.7, salt: 4 })],
          ]}
        />
      </PlainSection>
      <PlainSection
        id="grammar2"
        title="grammar2: grammar plus asymmetry and intensity (depth, trunks, fork rate, bend, tendrils)"
      >
        <Tail
          sizes={[320, 160, 80]}
          makers={[
            ["g2 mirror", S => grammar2(S, { asym: 0, intensity: 0 })],
            ["g2 asym .35", S => grammar2(S, { asym: 0.35, intensity: 0 })],
            ["g2 asym 1", S => grammar2(S, { asym: 1, intensity: 0 })],
            ["g2 intense .5", S => grammar2(S, { asym: 0, intensity: 0.5, salt: 5 })],
            ["g2 intense 1", S => grammar2(S, { asym: 0, intensity: 1, salt: 6 })],
            ["g2 intense asym", S => grammar2(S, { asym: 0.6, intensity: 1, salt: 7 })],
            ["g2 sliders", S => grammar2(S, {})],
          ]}
        />
      </PlainSection>
    </>
  )
}

export const PAGE: PageSpec = {
  id: "arches",
  title: "gothic: arch grammar, tracery, buildings",
  path: "/arches",
  specs: { families: GLOBALS, spread: SPREAD, lobes: LOBES, anatomy: ANATOMY, rose: ROSE, panel: PANEL },
  anchors: ["flamboyant", "pinnacle", "vault", "buttress", "bands", "facade", "noisy", "grammar", "grammar2"],
  Component: ArchesPage,
}
