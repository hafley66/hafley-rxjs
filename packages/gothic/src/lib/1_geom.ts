export type Pt = [number, number]

export const TAU = Math.PI * 2
export const f = (n: number): number => Math.round(n * 100) / 100
export const clamp = (t: number, a = 0, b = 1): number => (t < a ? a : t > b ? b : t)
export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t
export const polar = (r: number, a: number): Pt => [r * Math.cos(a), r * Math.sin(a)]
export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

export const M = (x: number, y: number): string => `M${f(x)} ${f(y)}`
export const L = (x: number, y: number): string => `L${f(x)} ${f(y)}`
export const arc = (r: number, x: number, y: number, sweep = 1, large = 0): string =>
  `A${f(r)} ${f(r)} 0 ${large} ${sweep} ${f(x)} ${f(y)}`
export const circle = (cx: number, cy: number, r: number): string =>
  M(cx - r, cy) + arc(r, cx + r, cy, 1, 1) + arc(r, cx - r, cy, 1, 1)
export const line = (x0: number, y0: number, x1: number, y1: number): string => M(x0, y0) + L(x1, y1)
export const poly = (pts: readonly Pt[]): string =>
  M(pts[0][0], pts[0][1]) +
  pts
    .slice(1)
    .map(p => L(p[0], p[1]))
    .join("") +
  "Z"
export const pl = (pts: readonly Pt[]): string => pts.map((p, i) => `${i ? "L" : "M"}${f(p[0])} ${f(p[1])}`).join("")

export const backOut = (t: number, b: number): number => {
  const q = t - 1
  return 1 + (b + 1) * q * q * q + b * q * q
}
export const ease = {
  in: (t: number) => t * t,
  out: (t: number) => 1 - (1 - t) ** 2,
  io: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  back: backOut,
}
export type EaseName = "in" | "out" | "io"
