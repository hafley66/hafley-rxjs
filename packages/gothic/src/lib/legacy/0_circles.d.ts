export type Rng = () => number
export type Pt = [number, number]
export type Sc = {
  parts: string[]
  defs: string[]
  path(d: string, cls?: string, attrs?: string): void
  raw(s: string): void
  def(s: string): void
  svg(box: number[]): string
}
export type Cell = { sc: Sc; box: number[] }
export type Globals = {
  weight: number
  seed: number
  sym: number
  intensity: number
  noise: number
  density: number
  lambda: number
  minPx: number
  anim: boolean
  ms: number
}
export const G: Globals
export function mulberry32(seed: number): Rng
export function vnoise(x: number, y?: number, seed?: number): number
export function foilRing(cx: number, cy: number, R: number, n: number, lambda?: number): string
export function layoutRings(R: number, spec: unknown): unknown[]
export function diagram(sc: Sc, R: number, spec: unknown, rng?: Rng, depth?: number): Sc
export function diagramCell(S: number, spec: unknown, seed: number): Cell
export function randomSpec(rng: Rng, I?: number, n?: number): Record<string, unknown>
export function fma(S: number, o?: { salt?: number; intensity?: number; n?: number; spec?: unknown }): Cell
export function flowerOfLife(sc: Sc, R: number, rings: number, r: number): Pt[]
export function flower(S: number, rings: number): Cell
export function metatron(S: number): Cell
export function vesicaLattice(S: number, n: number): Cell
export function spiroCell(S: number, p: number, q: number, d: number): Cell
export function morph(oldSvg: Element, newSvg: Element, ms?: number): number
export type Issue = { path: (string | number)[]; message: string }
export const Spec: {
  parse(v: unknown): unknown
  safeParse(v: unknown): { success: boolean; data?: unknown; error?: { issues: Issue[] } }
}
