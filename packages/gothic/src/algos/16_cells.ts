import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import { Delaunay } from "d3-delaunay"
import { SEED_INPUTS } from "../kit/0_inputs.js"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { mulberry32 } from "../lib/0_rng.js"
import { circle, poly, type Pt } from "../lib/1_geom.js"

export const SPEC = {
  seed: { ...SEED_INPUTS.seed, hint: "repeatable nucleation sites", default: 31 },
  sites: { kind: "range", hint: "crystal cells in the seal", min: 12, max: 120, step: 1, default: 48 },
  relax: { kind: "range", hint: "passes moving each site toward its cell's vertex mean", min: 0, max: 5, step: 1, default: 2 },
  inset: { kind: "range", hint: "shrink cells toward their sites to leave channels", min: 0.05, max: 0.5, step: 0.01, default: 0.18 },
  // scaffold:inputs
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>
export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  const R = ctx.size * 0.43, random = mulberry32(p.seed)
  let points: Pt[] = Array.from({ length: p.sites }, () => [(random() * 2 - 1) * R, (random() * 2 - 1) * R])
  for (let pass = 0; pass < p.relax; pass++) {
    const v = Delaunay.from(points).voronoi([-R, -R, R, R])
    points = points.map((point, i) => {
      const polygon = v.cellPolygon(i)?.slice(0, -1)
      return polygon?.length ? [polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length, polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length] : point
    })
  }
  const v = Delaunay.from(points).voronoi([-R, -R, R, R])
  const paths: AlgoOut["paths"] = [{ d: poly([[-R, -R], [R, -R], [R, R], [-R, R]]) }]
  for (const [i, site] of points.entries()) {
    const cell = v.cellPolygon(i)
    if (!cell) continue
    paths.push({ d: poly(cell.map(([x, y]): Pt => [site[0] + (x - site[0]) * (1 - p.inset), site[1] + (y - site[1]) * (1 - p.inset)])) })
    paths.push({ d: circle(...site, Math.max(0.7, ctx.size * 0.003)) })
  }
  return { paths, caption: "crystalline transmutation plate", lod: [] }
}
export const ALGO: Algo<Params> = { name: "cells", spec: SPEC, presets: { "shards": { sites: 24, relax: 0, inset: 0.09 }, "enamel": { sites: 72, relax: 4, inset: 0.3 } }, run: generate }
