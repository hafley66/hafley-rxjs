import type { Presets, Spec } from "@hafley66/report-shell"

export type AlgoCtx = { size: number; seed: number; minPx: number }
export type AlgoPath = { d: string; z?: number; cls?: string }
// raw: svg markup with no path form (textPath script bands); rendered after the paths
export type AlgoOut = { paths: AlgoPath[]; caption: string; lod: string[]; raw?: string[] }
export type Algo<P extends object> = {
  name: string
  spec: Spec<P>
  presets: Presets<P>
  run(params: P, ctx: AlgoCtx): AlgoOut
}

export const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback)
// ctx.seed / ctx.minPx come from params.seed / params.minPx when the spec has them
export const algoCtx = (params: object, size: number): AlgoCtx => {
  const p = params as Record<string, unknown>
  return { size, seed: num(p.seed, 0), minPx: num(p.minPx, 2) }
}
