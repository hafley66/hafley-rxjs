// d2 renders markdown labels as foreignObject HTML, which the sanitizers
// remove; each block becomes wrapped svg text instead.
export function foreignObjectsToText(source: string, fontSize = 16): string {
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml")
  if (parsed.querySelector("parsererror")) return source
  const svgNamespace = "http://www.w3.org/2000/svg"

  for (const foreign of [...parsed.querySelectorAll("foreignObject")]) {
    const x = Number.parseFloat(foreign.getAttribute("x") ?? "0")
    const y = Number.parseFloat(foreign.getAttribute("y") ?? "0")
    const width = Number.parseFloat(foreign.getAttribute("width") ?? "0")
    if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0) continue

    const lineHeight = fontSize * 1.5
    const charactersPerLine = Math.max(Math.floor(width / (fontSize * 0.55)), 8)
    const blocks = [...foreign.querySelectorAll("p, li, h1, h2, h3, h4, pre, blockquote")]
    const paragraphs = (blocks.length > 0 ? blocks : [foreign]).map(block =>
      (block.textContent ?? "").replace(/\s+/g, " ").trim(),
    ).filter(text => text.length > 0)

    const text = parsed.createElementNS(svgNamespace, "text")
    text.setAttribute("x", x.toFixed(2))
    text.setAttribute("y", (y + fontSize).toFixed(2))
    text.setAttribute("fill", "#0A0F25")
    text.setAttribute("style", `font-size:${fontSize}px;line-height:${lineHeight}px`)

    let first = true
    for (const paragraph of paragraphs) {
      for (const line of wrap(paragraph, charactersPerLine)) {
        const tspan = parsed.createElementNS(svgNamespace, "tspan")
        tspan.setAttribute("x", x.toFixed(2))
        tspan.setAttribute("y", "0")
        tspan.setAttribute("dy", first ? "0" : lineHeight.toFixed(2))
        tspan.textContent = line
        text.appendChild(tspan)
        first = false
      }
      // A blank line between paragraphs.
      if (!first) {
        const spacer = parsed.createElementNS(svgNamespace, "tspan")
        spacer.setAttribute("x", x.toFixed(2))
        spacer.setAttribute("y", "0")
        spacer.setAttribute("dy", (lineHeight / 2).toFixed(2))
        text.appendChild(spacer)
      }
    }

    foreign.replaceWith(text)
  }

  return new XMLSerializer().serializeToString(parsed)
}

function wrap(text: string, charactersPerLine: number): string[] {
  const lines: string[] = []
  for (const word of text.split(" ")) {
    const last = lines.at(-1)
    if (last !== undefined && last.length > 0 && last.length + 1 + word.length <= charactersPerLine) {
      lines[lines.length - 1] = `${last} ${word}`
    } else {
      lines.push(word)
    }
  }
  return lines
}
