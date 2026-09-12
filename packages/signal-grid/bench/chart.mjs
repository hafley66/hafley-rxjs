// The matrix as one SVG. Two plots share every row: the left is the frame the user feels, the
// right is the work the package did inside it, because the left saturates at the vsync tick and
// stops separating cells long before the right does.
const W = 900
const LABEL = 238
const PLOT_A = 300
const PLOT_B = 190
const GAP = 14
const ROW = 17
const HEAD = 34
const PAD = 12

const A_MAX = 40
const B_MAX = 3.6
const VSYNC = 8.33
const SLOW = 32

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;")
const domOf = (r) => (r.stages.find((it) => it.stage === "signal-grid.dom")?.ms ?? 0) / Math.max(1, r.frames)
const hue = (p50) => (p50 < 12 ? "#6fd7ad" : p50 < SLOW ? "#e2b45e" : "#e06c6c")

/** One SVG for the whole report. `report` is what `bench/scroll.mjs` holds: blocks of measured rows. */
export function chart(report) {
  const aX = LABEL
  const bX = LABEL + PLOT_A + GAP
  const gX = bX + PLOT_B + GAP
  const out = []
  let y = PAD
  for (const block of report) {
    out.push(`<text x="0" y="${y + 12}" class="h">${esc(block.n)}. ${esc(block.title)}</text>`)
    out.push(`<text x="${aX}" y="${y + 26}" class="k">frame p50 ms</text>`)
    out.push(`<text x="${bX}" y="${y + 26}" class="k">dom build ms per frame</text>`)
    out.push(`<text x="${gX}" y="${y + 26}" class="k">slow / heap MB / nodes</text>`)
    y += HEAD
    const top = y
    for (const r of block.rows) {
      const a = Math.min(1, r.p50 / A_MAX) * PLOT_A
      const b = Math.min(1, domOf(r) / B_MAX) * PLOT_B
      out.push(`<text x="0" y="${y + 10}" class="l">${esc(r.label)}</text>`)
      out.push(`<rect x="${aX}" y="${y + 2}" width="${a.toFixed(1)}" height="11" fill="${hue(r.p50)}"/>`)
      out.push(`<text x="${(aX + a + 4).toFixed(1)}" y="${y + 11}" class="n">${r.p50.toFixed(1)}</text>`)
      out.push(`<rect x="${bX}" y="${y + 2}" width="${b.toFixed(1)}" height="11" fill="#5a8fd6"/>`)
      out.push(`<text x="${(bX + b + 4).toFixed(1)}" y="${y + 11}" class="n">${domOf(r).toFixed(2)}</text>`)
      const gut = `${r.slow} / ${(r.heapMb ?? 0).toFixed(0)} / ${r.nodes}`
      out.push(`<text x="${gX}" y="${y + 11}" class="n">${esc(gut)}</text>`)
      y += ROW
    }
    for (const [at, label] of [[VSYNC, "120 Hz"], [SLOW, "32 ms"]]) {
      const x = aX + (at / A_MAX) * PLOT_A
      out.push(`<line x1="${x.toFixed(1)}" y1="${top}" x2="${x.toFixed(1)}" y2="${y}" class="g"/>`)
      out.push(`<text x="${(x + 2).toFixed(1)}" y="${top - 2}" class="k">${label}</text>`)
    }
    y += 18
  }
  const height = y + PAD
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" font-family="system-ui, sans-serif">`,
    `<style>text{fill:#c9d1d9}.h{font-size:12px;font-weight:600;fill:#e6e8ea}.l{font-size:10px}`,
    `.n{font-size:9px;fill:#8b949e}.k{font-size:9px;fill:#6e7681}.g{stroke:#3a4048;stroke-width:1}</style>`,
    `<rect width="${W}" height="${height}" fill="#14161a"/>`,
    `<g transform="translate(${PAD},0)">`,
    ...out,
    `</g></svg>`,
  ].join("")
}
