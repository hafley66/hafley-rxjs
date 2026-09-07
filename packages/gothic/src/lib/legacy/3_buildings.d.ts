export type Sc = { parts: string[]; path(d: string, cls?: string): void; svg(box: number[]): string }
export type Cell = { sc: Sc; box: number[] }
export type Opts = Record<string, unknown>

export function rose(S: number, o?: Opts): Cell
export function panelTracery(S: number, o?: Opts): Cell
export function vesica(S: number, o?: Opts): Cell
export function soufflet(S: number, o?: Opts): Cell
export function mouchette(S: number, o?: Opts): Cell
export function pinnacle(S: number, o?: Opts): Cell
export function pinnacleAt(sc: Sc, cx: number, yBase: number, H: number, depth: number, o?: Opts): void
export function vault(S: number, o?: Opts): Cell
export function flyingButtress(S: number, o?: Opts): Cell
export function band(S: number, type: string, o?: Opts): Cell
export function facade(S: number, o?: Opts): Cell
export function ring(S: number, n: number, shape?: string): Cell
export function head(S: number, foils: number, shape?: string, k?: number): Cell
export function capital(S: number, o?: Opts): Cell
export function base(S: number): Cell
export function corbel(S: number, o?: Opts): Cell
export function boss(S: number, o?: Opts): Cell
export function hoodMould(S: number, o?: Opts): Cell
export function finialOf(S: number, type: string): Cell
export function crocketsOf(S: number, type: string): Cell
export function fleuron(S: number, o?: Opts): Cell
export function grammar(S: number, o?: Opts): Cell
export function grammar2(S: number, o?: Opts): Cell
