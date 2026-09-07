export type Rng = () => number
export type Tudor = { h: number; phi: number; m: number }
export type ArchSpec = {
  k: number
  foils: number
  ogee: number
  tudor: Tudor | null
  depth: number
  legs: number
  lambda: number
  minLobe: number
  minSub: number
  weight: number
  guides: boolean
  lobe: string
  seed: number
  noise: number
  asym: number
  intensity: number
}
export type Build = { d: string[]; aux: string[]; rise: number; lod: string[] }
export const DEFAULT: ArchSpec
export const global: ArchSpec
export const families: Record<string, Partial<ArchSpec>>
export const SIZES: number[]
export const axes: Record<string, [number, number]>
export function mulberry32(seed: number): Rng
export function vnoise(x: number, y?: number, seed?: number): number
export function fbm(x: number, y: number, oct?: number, seed?: number): number
export function twoCentred(a: number, k: number): { r: number; rise: number; cL: number[]; cR: number[]; delta: number }
export function sampleHead(a: number, k: number, n: number): [number, number][]
export function bisect(lo: number, hi: number, ok: (x: number) => boolean, it?: number): number
export function insideHead(a: number, k: number): (x: number, y: number) => boolean
export function sampleHeadN(
  a: number,
  k: number,
  n: number,
): { P: [number, number][]; N: ([number, number] | null)[]; apex: { r: number; cx: number } }
export function cusped(
  P: [number, number][],
  N: ([number, number] | null)[],
  lambda: number,
  closed: boolean,
  rhoMax: number,
  shape?: string,
  inside?: ((x: number, y: number) => boolean) | null,
  apex?: { r: number; cx: number } | null,
): string | null
export function foilRing(cx: number, cy: number, R: number, n: number, lambda?: number, shape?: string): string | null
export function build(s: Partial<ArchSpec>, px: number, a?: number, ox?: number, depth?: number, out?: Build): Build
export function cell(s: Partial<ArchSpec>, spanPx: number): { svg: SVGSVGElement; lod: string[] }
