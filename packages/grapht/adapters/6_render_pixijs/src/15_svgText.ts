import { Text, type Container } from "pixi.js"

function inlineStyle(element: SVGTextElement): Map<string, string> {
  return new Map((element.getAttribute("style") ?? "").split(";").flatMap(declaration => {
    const separator = declaration.indexOf(":")
    return separator < 0 ? [] : [[declaration.slice(0, separator).trim(), declaration.slice(separator + 1).trim()]]
  }))
}

function inheritedStyle(element: SVGTextElement, property: string): string | undefined {
  for (let current: Element | null = element; current; current = current.parentElement) {
    const value = inlineStyle(current as SVGTextElement).get(property)
    if (value) return value
  }
}

function svgLength(value: string | null | undefined, em: number): number {
  if (!value) return 0
  if (value.endsWith("em")) return Number(value.slice(0, -2)) * em
  return Number(value.replace("px", ""))
}

export function replaceSvgTextNodes(config: {
  root: SVGSVGElement
  nodes: Map<SVGElement, Container>
  resolution: number
}): Text[] {
  const texts: Text[] = []
  for (const element of config.root.querySelectorAll<SVGTextElement>("text")) {
    const svgNode = config.nodes.get(element)
    const parentNode = element.parentElement ? config.nodes.get(element.parentElement as unknown as SVGElement) : undefined
    if (!svgNode || !parentNode) continue

    const style = inlineStyle(element)
    const tspans = [...element.querySelectorAll("tspan")]
    const content = tspans.length ? tspans.map(tspan => tspan.textContent ?? "").join("\n") : element.textContent?.trim() ?? ""
    const fontSize = svgLength(element.getAttribute("font-size") ?? style.get("font-size") ?? inheritedStyle(element, "font-size") ?? "16", 16)
    const baseline = element.getAttribute("dominant-baseline") ?? element.getAttribute("alignment-baseline")
    const lineHeight = tspans.length > 1 ? Number(tspans[1].getAttribute("dy") ?? fontSize * 1.2) : undefined
    const text = new Text({
      text: content,
      resolution: config.resolution,
      style: {
        fill: element.getAttribute("fill") ?? style.get("fill") ?? "black",
        fontFamily: element.getAttribute("font-family") ?? style.get("font-family") ?? (element.classList.contains("text-mono") ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "sans-serif"),
        fontSize,
        fontStyle: (element.getAttribute("font-style") ?? style.get("font-style") ?? "normal") as "normal" | "italic" | "oblique",
        fontWeight: (element.getAttribute("font-weight") ?? style.get("font-weight") ?? "normal") as "normal" | "bold" | "bolder" | "lighter" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900",
        lineHeight,
      },
    })
    const textAnchor = element.getAttribute("text-anchor") ?? style.get("text-anchor")
    text.anchor.x = textAnchor === "middle" ? 0.5 : textAnchor === "end" ? 1 : 0
    const x = svgLength(element.getAttribute("x") ?? tspans[0]?.getAttribute("x"), fontSize)
    const y = svgLength(element.getAttribute("y"), fontSize)
    text.position.set(x, baseline === "central" || baseline === "middle" ? y - text.height / 2 : y - fontSize)
    svgNode.renderable = false
    parentNode.addChild(text)
    config.nodes.set(element, text)
    texts.push(text)
  }
  return texts
}
