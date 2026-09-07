import { type RefObject, useEffect, useRef } from "react"
import { sealAlgo } from "../algos/0_seal.js"
import type { PageSpec } from "../app/0_pages.js"
import { type AnySpec, type ValuesOf } from "../kit/0_spec.js"
import { type EyeOpts, eye, hash, sealCaption, sealSvg } from "../lib/index.js"
import { stagger } from "../ui/0_hooks.js"
import { AlgoSection } from "../ui/4_Algo.js"
import { Section } from "../ui/2_Section.js"
import { Raw } from "../ui/5_Raw.js"

const SPEC = {
  seed: { kind: "seed", default: 1 },
  minPx: { kind: "range", min: 1, max: 6, step: 0.5, default: 2 },
  names: {
    kind: "text",
    default: "github rxjs hn docs mail calendar grapht boop gothic tanstack vite playwright",
    size: 60,
    shuffle: false,
  },
  weight: { kind: "range", min: 0.5, max: 2.5, step: 0.1, default: 1, static: true },
  anim: { kind: "bool", default: true, label: "draw-in", static: true },
} as const satisfies AnySpec
type V = ValuesOf<typeof SPEC>

const SIZES = [16, 20, 24, 32, 48, 96]
const EYE_SIZES: [number, number][] = [
  [16, 8],
  [24, 12],
  [32, 14],
  [48, 22],
  [64, 28],
  [96, 44],
  [160, 70],
]
const VARIANTS: EyeOpts[] = [
  { lobes: 3 },
  { lobes: 5, double: true },
  { lobes: 6, lash: 0, iris: 0.3 },
  { lobes: 4, lash: 4, lashLen: 0.45 },
]

function Icons({ v, stats }: { v: V; stats: RefObject<HTMLSpanElement | null> }) {
  const host = useRef<HTMLDivElement>(null)
  const names = v.names.trim().split(/\s+/)
  const sd = (name: string) => (hash(name) ^ Math.imul(v.seed, 2654435761)) >>> 0

  useEffect(() => {
    document.documentElement.style.setProperty("--w", String(v.weight))
  }, [v.weight])

  useEffect(() => {
    const n = stagger(host.current)
    if (stats.current) stats.current.textContent = `${names.length} names · ${n} paths`
    const ico = host.current?.querySelector("svg")
    if (!ico) return
    let link = document.querySelector<HTMLLinkElement>("link[rel=icon]")
    if (!link) {
      link = document.createElement("link")
      link.rel = "icon"
      document.head.append(link)
    }
    link.href = `data:image/svg+xml,${encodeURIComponent(
      ico.outerHTML
        .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" style="color:#e2c77a" ')
        .replace(/stroke-width="[^"]*"/g, "")
        .replace("<svg", '<svg stroke="#e2c77a" fill="none" stroke-width="1.2"'),
    )}`
  })

  return (
    <div ref={host} className={`grid gap-5 ${v.anim ? "kit-draw" : ""}`}>
      <section>
        <h2 className="mb-2 font-medium text-muted">favorites bar (16px, favicon set to the first)</h2>
        <div className="flex flex-wrap gap-1 rounded-md bg-well px-2 py-1.5">
          {names.map(n => (
            <a
              key={n}
              href="#/icons"
              className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-fg text-xs no-underline hover:bg-line"
            >
              <Raw html={sealSvg(16, sd(n), v.minPx).svg} />
              {n}
            </a>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-medium text-muted">
          fma seals by name × size: caption = symmetry n, band list, LOD downgrades
        </h2>
        <table className="border-collapse">
          <tbody>
            <tr>
              <th className="px-2.5 py-1.5 text-left font-normal text-muted">name</th>
              {SIZES.map(s => (
                <th key={s} className="px-2.5 py-1.5 text-left font-normal text-muted">
                  {s}
                </th>
              ))}
              <th className="px-2.5 py-1.5 text-left font-normal text-muted">caption</th>
            </tr>
            {names.map(n => (
              <tr key={n}>
                <td className="whitespace-nowrap px-2.5 py-1.5 text-muted">{n}</td>
                {SIZES.map(s => (
                  <td key={s} className="px-2.5 py-1.5">
                    <Raw html={sealSvg(s, sd(n), v.minPx).svg} />
                  </td>
                ))}
                <td className="whitespace-nowrap px-2.5 py-1.5 text-muted">
                  {sealCaption(sealSvg(96, sd(n), v.minPx))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2 className="mb-2 font-medium text-muted">
          gothic eyes: vesica lids by exact sagitta, iris = foil ring fit to lid height, lashes = ticks
        </h2>
        <div className="row flex flex-wrap items-end gap-3.5">
          {EYE_SIZES.flatMap(([W, H]) =>
            VARIANTS.map(o => (
              <div
                key={`${W}-${o.lobes}-${o.lash}`}
                className="cell grid justify-items-center gap-1 text-[10px] text-muted"
              >
                <Raw html={eye(W, H, o, v.minPx).svg} />
                <span>{`${W}×${H} f${o.lobes}${o.double ? " dbl" : ""}${o.lash === 0 ? " bare" : ""}`}</span>
              </div>
            )),
          )}
        </div>
      </section>
    </div>
  )
}

function IconsPage() {
  const stats = useRef<HTMLSpanElement>(null)
  return (
    <>
      <Section page="icons" def={{ id: "icons", title: "icons", spec: SPEC }} extra={<span ref={stats} />}>
        {v => <Icons v={v as V} stats={stats} />}
      </Section>
      <AlgoSection
        page="icons"
        algo={sealAlgo}
        sizes={[16, 24, 32, 48, 64, 96, 160]}
        title="seal as Algo: sizes row with LOD captions, data-z depth from band index"
      />
    </>
  )
}

export const PAGE: PageSpec = {
  id: "icons",
  title: "gothic: fma favicons + eyes",
  path: "/icons",
  specs: { icons: SPEC, seal: sealAlgo.spec as unknown as AnySpec },
  Component: IconsPage,
}
