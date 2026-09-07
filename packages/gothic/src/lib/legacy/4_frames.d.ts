export type Rng = () => number
export type Opts = { seed?: number; preset?: string; density?: number; weight?: number; pad?: number }
export type Mount = { el: Element; opts: Opts; svg: SVGSVGElement | null; w: number; h: number; seed: number }

export function mulberry32(seed: number): Rng
export function hash(s: string): number
export const corners: Record<string, unknown>
export const finials: Record<string, unknown>
export const rails: Record<string, unknown>
export const presets: Record<string, { corner: string; finial: string; rail: string }>
export function plan(w: number, h: number, opts?: Opts): Record<string, unknown>
export function compose(p: Record<string, unknown>): Record<string, unknown>[]
export function emitSVG(placed: Record<string, unknown>[], p: Record<string, unknown>): SVGSVGElement
export function emitDataURI(placed: Record<string, unknown>[], p: Record<string, unknown>, ink?: string): string
export function attach(el: Element, opts?: Opts): Mount
export function detach(el: Element): void
export function reseed(el: Element, seed?: number): void
