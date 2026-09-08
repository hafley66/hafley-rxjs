import { circle, f } from "./1_geom.js"

// Inline presentation survives the notebook's global SVG stroke rules.
export function ink(d: string, fill = "none", stroke = "none", width = 1, attrs = ""): string {
  return `<path d="${d}" style="fill:${fill};stroke:${stroke};stroke-width:${f(width)}" ${attrs}/>`
}

export function roundel(r: number, fill: string, stroke = "none", width = 1): string {
  return ink(circle(0, 0, r), fill, stroke, width)
}

export function plate(size: number, id: string, body: string): string {
  return `<g transform="scale(${size / 1000})"><defs>
    <radialGradient id="${id}-night"><stop stop-color="#1c3538"/><stop offset=".65" stop-color="#101e24"/><stop offset="1" stop-color="#060a10"/></radialGradient>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ede0b4"/><stop offset=".22" stop-color="#a78649"/><stop offset=".48" stop-color="#e6d5a5"/><stop offset=".72" stop-color="#79613d"/><stop offset="1" stop-color="#bda56d"/></linearGradient>
    <linearGradient id="${id}-bone"><stop stop-color="#3a403f"/><stop offset=".3" stop-color="#bbb5a0"/><stop offset=".52" stop-color="#ebe1c7"/><stop offset=".7" stop-color="#8b8c7c"/><stop offset="1" stop-color="#323b3e"/></linearGradient>
    <radialGradient id="${id}-glass"><stop stop-color="#315e63"/><stop offset=".6" stop-color="#18323f"/><stop offset="1" stop-color="#08171f"/></radialGradient>
  </defs><path d="M-500 -500H500V500H-500Z" style="fill:url(#${id}-night);stroke:none"/>${body}</g>`
}
