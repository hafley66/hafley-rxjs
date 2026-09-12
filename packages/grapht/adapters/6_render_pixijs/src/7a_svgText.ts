import { Text, type Container } from "pixi.js"

const PRESENTATION_ATTRIBUTES = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-dasharray",
  "opacity",
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "text-anchor",
] as const

/** Resolves stylesheet rules into presentation attributes before SVGScene consumes the detached SVG. */
export function svgRootForPixi(document: Document, source: string): SVGSVGElement {
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml")
  if (parsed.querySelector("parsererror")) throw new Error("Pixi SVG source is not valid XML")
  const root = document.importNode(parsed.documentElement, true)
  if (!(root instanceof SVGSVGElement)) throw new Error("Pixi SVG source has no SVG root")
  const host = document.createElement("div")
  host.setAttribute("style", "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none")
  host.appendChild(root)
  document.body.appendChild(host)
  try {
    const view = document.defaultView
    if (view === null) throw new Error("Pixi SVG style resolution requires a document window")
    for (const element of root.querySelectorAll<SVGElement>("*") ) {
      const computed = view.getComputedStyle(element)
      for (const property of PRESENTATION_ATTRIBUTES) {
        const value = computed.getPropertyValue(property)
        if (value) element.setAttribute(property, value)
      }
    }
  } finally {
    root.remove()
    host.remove()
  }
  return root
}

function inlineStyle(element: Element): Map<string, string> {
  return new Map((element.getAttribute("style") ?? "").split(";").flatMap(declaration => {
    const separator = declaration.indexOf(":")
    return separator < 0 ? [] : [[declaration.slice(0, separator).trim(), declaration.slice(separator + 1).trim()]]
  }))
}

function inheritedStyle(element: Element, property: string): string | undefined {
  for (let current: Element | null = element; current; current = current.parentElement) {
    const value = inlineStyle(current).get(property) ?? current.getAttribute(property) ?? undefined
    if (value) return value
  }
}

function length(value: string | null | undefined, em: number): number {
  if (!value) return 0
  if (value.endsWith("em")) return Number(value.slice(0, -2)) * em
  return Number(value.replace("px", ""))
}

/** Replaces SVGScene's canvas text nodes with Pixi Text while preserving the SVG element mapping. */
export function replaceSvgTextNodes(root: SVGSVGElement, nodes: Map<SVGElement, Container | null>, resolution: number): void {
  for (const element of root.querySelectorAll<SVGTextElement>("text")) {
    const svgNode = nodes.get(element)
    const parentNode = element.parentElement ? nodes.get(element.parentElement as unknown as SVGElement) : undefined
    if (svgNode == null || parentNode == null) continue

    const style = inlineStyle(element)
    const tspans = [...element.querySelectorAll("tspan")]
    const content = tspans.length > 0 ? tspans.map(tspan => tspan.textContent ?? "").join("\n") : element.textContent?.trim() ?? ""
    const fontSize = length(element.getAttribute("font-size") ?? style.get("font-size") ?? inheritedStyle(element, "font-size") ?? "16", 16)
    const baseline = element.getAttribute("dominant-baseline") ?? element.getAttribute("alignment-baseline")
    const text = new Text({
      text: content,
      resolution,
      style: {
        fill: element.getAttribute("fill") ?? style.get("fill") ?? inheritedStyle(element, "fill") ?? "black",
        fontFamily: element.getAttribute("font-family") ?? style.get("font-family") ?? inheritedStyle(element, "font-family") ?? "sans-serif",
        fontSize,
        fontStyle: (element.getAttribute("font-style") ?? style.get("font-style") ?? inheritedStyle(element, "font-style") ?? "normal") as "normal" | "italic" | "oblique",
        fontWeight: (element.getAttribute("font-weight") ?? style.get("font-weight") ?? inheritedStyle(element, "font-weight") ?? "normal") as "normal" | "bold" | "bolder" | "lighter" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900",
        lineHeight: tspans.length > 1 ? length(tspans[1].getAttribute("dy"), fontSize) : undefined,
      },
    })
    const anchor = element.getAttribute("text-anchor") ?? style.get("text-anchor") ?? inheritedStyle(element, "text-anchor")
    text.anchor.x = anchor === "middle" ? 0.5 : anchor === "end" ? 1 : 0
    const x = length(element.getAttribute("x") ?? tspans[0]?.getAttribute("x"), fontSize)
    const y = length(element.getAttribute("y"), fontSize)
    text.position.set(x, baseline === "central" || baseline === "middle" ? y - text.height / 2 : y - fontSize)
    svgNode.renderable = false
    parentNode.addChild(text)
    nodes.set(element, text)
  }
}
