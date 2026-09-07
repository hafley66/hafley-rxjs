import type { Presets, Spec } from "./0_spec.js"
import { type Section, section } from "./3_section.js"
import { stagger } from "./4_anim.js"

export type AlgoCtx = { size: number; seed: number; minPx: number }
export type AlgoPath = { d: string; z?: number; cls?: string }
export type AlgoOut = { paths: AlgoPath[]; caption: string; lod: string[] }
export type Algo<P extends object> = {
  name: string
  spec: Spec<P>
  presets: Presets<P>
  run(params: P, ctx: AlgoCtx): AlgoOut
}

const f = (n: number) => Math.round(n * 100) / 100

// z lands on data-z; the kit's depth rule reads it (see kit/README.md)
export const algoSvg = (out: AlgoOut, size: number): string =>
  `<svg class="kit-draw" viewBox="${f(-size / 2)} ${f(-size / 2)} ${size} ${size}" width="${size}" height="${size}">${out.paths
    .map(
      p =>
        `<path d="${p.d}" pathLength="1"${p.cls ? ` class="${p.cls}"` : ""}${p.z === undefined ? "" : ` data-z="${f(p.z)}"`}/>`,
    )
    .join("")}</svg>`

const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback)

// one cell per size; ctx.seed / ctx.minPx come from params.seed / params.minPx when the spec has them
export function mountAlgo<P extends object>(
  algo: Algo<P>,
  host: HTMLElement,
  sizes: readonly number[],
  params: P,
): AlgoOut[] {
  const p = params as Record<string, unknown>
  const outs = sizes.map(size => algo.run(params, { size, seed: num(p.seed, 0), minPx: num(p.minPx, 2) }))
  host.innerHTML = `<div class="row">${outs
    .map(
      (out, i) =>
        `<div class="cell">${algoSvg(out, sizes[i])}<span>${sizes[i]} · ${out.caption}${out.lod.length ? ` · ${out.lod.join(" ")}` : ""}</span></div>`,
    )
    .join("")}</div>`
  stagger(host)
  return outs
}

export function algoSection<P extends object>(
  algo: Algo<P>,
  sizes: readonly number[],
  title = algo.name,
): Section<Spec<P>> {
  return section<Spec<P>>({
    id: algo.name,
    title,
    spec: algo.spec,
    presets: algo.presets as never,
    zDepth: true,
    render: (v, host) => mountAlgo(algo, host, sizes, v as never),
  })
}
