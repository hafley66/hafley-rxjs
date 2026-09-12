// d2 renders markdown labels as foreignObject HTML, which the sanitizers
// remove; each block becomes width-measured svg text instead.
export function foreignObjectsToText(source: string, startFontSize = 16): string {
  const ownerDocument = globalThis.document
  if (ownerDocument === undefined) return source
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml")
  if (parsed.querySelector("parsererror")) return source

  const svgNamespace = "http://www.w3.org/2000/svg"
  const measureHost = ownerDocument.createElement("div")
  measureHost.setAttribute("style", "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none")
  const root = parsed.documentElement
  measureHost.appendChild(root)
  ownerDocument.body.appendChild(measureHost)

  try {
    const probeText = parsed.createElementNS(svgNamespace, "text")
    probeText.setAttribute("style", "opacity:0")
    root.appendChild(probeText)
    const measure = (text: string, fontSize: number): number => {
      const probe = parsed.createElementNS(svgNamespace, "tspan")
      probe.setAttribute("style", `font-size:${fontSize}px`)
      probe.textContent = text
      probeText.appendChild(probe)
      const length = probe.getComputedTextLength()
      probe.remove()
      return length
    }

    for (const foreign of [...root.querySelectorAll("foreignObject")]) {
      const x = Number.parseFloat(foreign.getAttribute("x") ?? "0")
      const y = Number.parseFloat(foreign.getAttribute("y") ?? "0")
      const width = Number.parseFloat(foreign.getAttribute("width") ?? "0")
      const height = Number.parseFloat(foreign.getAttribute("height") ?? "0")
      if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0) continue

      const blocks = [...foreign.querySelectorAll("p, li, h1, h2, h3, h4, pre, blockquote")]
      const paragraphs = (blocks.length > 0 ? blocks : [foreign])
        .map(block => (block.textContent ?? "").replace(/\s+/g, " ").trim())
        .filter(text => text.length > 0)
      if (paragraphs.length === 0) continue

      let fontSize = startFontSize
      let lines: string[] = []
      let fits = false
      while (true) {
        lines = wrapMeasured(paragraphs, text => measure(text, fontSize), width)
        fits = height > 0 ? lines.length * fontSize * 1.5 <= height : true
        if (fits || fontSize <= 10) break
        fontSize -= 1
      }

      const lineHeight = fontSize * 1.5
      const text = parsed.createElementNS(svgNamespace, "text")
      text.setAttribute("x", x.toFixed(2))
      text.setAttribute("y", (y + fontSize).toFixed(2))
      text.setAttribute("fill", "#0A0F25")
      text.setAttribute("style", `font-size:${fontSize}px;line-height:${lineHeight}px`)

      let first = true
      for (const line of lines) {
        const tspan = parsed.createElementNS(svgNamespace, "tspan")
        tspan.setAttribute("x", x.toFixed(2))
        tspan.setAttribute("y", "0")
        tspan.setAttribute("dy", first ? "0" : lineHeight.toFixed(2))
        tspan.textContent = line
        text.appendChild(tspan)
        first = false
      }
      foreign.replaceWith(text)
    }

    probeText.remove()
    return new XMLSerializer().serializeToString(root)
  } finally {
    measureHost.remove()
  }
}

type WrapResult = string[]

function wrapMeasured(paragraphs: readonly string[], measure: (text: string) => number, width: number): WrapResult {
  const spaceWidth = measure(" ")
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    let line = ""
    let lineWidth = 0
    for (const word of paragraph.split(" ")) {
      const wordWidth = measure(word)
      const nextWidth = line.length === 0 ? wordWidth : lineWidth + spaceWidth + wordWidth
      if (line.length > 0 && nextWidth > width) {
        lines.push(line)
        line = word
        lineWidth = wordWidth
      } else {
        line = line.length === 0 ? word : `${line} ${word}`
        lineWidth = nextWidth
      }
    }
    if (line.length > 0) lines.push(line)
    lines.push("")
  }
  return lines.slice(0, -1)
}
