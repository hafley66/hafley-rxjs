export type { Cell, Globals, Issue, Pt, Rng, Sc } from "./0_circles.js"
import type { Cell, Globals, Rng } from "./0_circles.js"

export const G: Globals
export const BW: Record<string, string>
export function mulberry32(seed: number): Rng
export function randomSpec(rng: Rng, I?: number, n?: number): Record<string, unknown>
export function fma(S: number, o?: { salt?: number; intensity?: number; n?: number; spec?: unknown }): Cell
export function islamic(
  S: number,
  tile: "square" | "hex" | "octsquare",
  thetaDeg: number,
  o?: { cell?: number; tiles?: boolean },
): Cell
export function mosaicRings(
  S: number,
  o?: { salt?: number; r0?: number; cell?: number; jitter?: number; dark?: number },
): Cell
export function fanMosaic(S: number, o?: { cell?: number; arcs?: number }): Cell
export function bwCircle(S: number, name: string, o?: { cell?: number; rot?: number }): Cell
export function bwShade(S: number, name: string, rings?: number): Cell
