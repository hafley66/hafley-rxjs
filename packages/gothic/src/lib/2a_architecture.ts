import { circle, f, L, M, poly } from "./1_geom.js"

// Width is the full spring-line span. The two curves meet at a pointed crown.
export function ogive(cx: number, spring: number, width: number, rise: number): string {
  const l = cx - width / 2, r = cx + width / 2, top = spring - rise
  return `${M(l, spring)}C${f(l)} ${f(spring - rise * 0.55)} ${f(cx - width * 0.22)} ${f(top + rise * 0.16)} ${f(cx)} ${f(top)}C${f(cx + width * 0.22)} ${f(top + rise * 0.16)} ${f(r)} ${f(spring - rise * 0.55)} ${f(r)} ${f(spring)}`
}

export function lancet(cx: number, base: number, width: number, height: number): string {
  const spring = base - height * 0.55
  return `${M(cx - width / 2, base)}${L(cx - width / 2, spring)}${ogive(cx, spring, width, height * 0.45)}${L(cx + width / 2, base)}`
}

export function spire(cx: number, base: number, width: number, height: number, crockets: number): string[] {
  const shoulder = base - height * 0.28
  const top = base - height
  const paths = [
    poly([[cx - width / 2, base], [cx - width * 0.4, shoulder], [cx, top], [cx + width * 0.4, shoulder], [cx + width / 2, base]]),
    `${M(cx, shoulder)}${L(cx, top)}`,
    lancet(cx, base - height * 0.02, width * 0.48, height * 0.24),
    `${M(cx - width * 0.47, shoulder)}${L(cx + width * 0.47, shoulder)}`,
    circle(cx, top - width * 0.05, width * 0.045),
  ]
  for (let i = 1; i <= crockets; i++) {
    const t = i / (crockets + 1)
    const y = shoulder - t * height * 0.72
    const w = width * 0.4 * (1 - t)
    const leaf = width * (0.17 - t * 0.07)
    for (const side of [-1, 1]) {
      const x = cx + side * w
      paths.push(`${M(x, y)}Q${f(x + side * leaf * 1.8)} ${f(y - leaf * 0.2)} ${f(x + side * leaf)} ${f(y - leaf * 1.5)}Q${f(x + side * leaf * 0.15)} ${f(y - leaf * 0.5)} ${f(x)} ${f(y)}`)
    }
  }
  return paths
}
