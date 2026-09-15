// Apply the shared Cytoscape paint rules to known Mermaid and D2 SVG primitives.
import type { GraphStyle } from "./0_graphStyle.js"
import { graphStylesheet } from "./1_graphStylesheet.js"

// Source SVG selectors paired with the corresponding native primitive role. Geometry and text
// metrics stay source-owned; this adapter maps paint, rather than rerunning source layout.
const styleIds = new WeakMap<SVGSVGElement, string>()
let nextStyleId = 0

const SVG_ROLES: Record<string, { shape?: string; text?: string; edge?: string; arrow?: string }> = {
  node: { shape: ".shape rect, .shape ellipse, .shape polygon, .shape path, rect.actor", text: "text, tspan" },
  "node[nativeKind = 'actor-shape']": { shape: 'rect.actor, [data-graph-role="actor-shape"], [data-graph-role="actor-bottom-shape"]', text: 'text.actor, text.actor-box, text.actor tspan, [data-graph-role="actor-label"], [data-graph-role="actor-bottom-label"]' },
  "node[nativeKind = 'lifeline']": { shape: ".actor-line" },
  "node[nativeKind = 'group-frame']": { shape: '.loopLine, [data-graph-role="group-frame"]' },
  "node[nativeKind = 'group-label']": { text: ".labelText, .loopText, .loopText tspan" },
  "node[nativeKind = 'activation']": { shape: '[class^="activation"]' },
  "node[nativeKind = 'note-shape']": { shape: 'rect.note, [data-graph-role="note-shape"]', text: ".noteText, .noteText tspan" },
  edge: { edge: ".connection", text: ".connection ~ text", arrow: "marker path, marker polygon" },
  ".graph-native-message": { edge: '.messageLine0, .messageLine1, [data-graph-role="message-line"], [data-graph-role="connector"]', text: '.messageText, .messageText tspan, [data-graph-role="message-label"]', arrow: "marker path, marker polygon" },
  "node[nativeKind = 'shape']": { shape: '[data-graph-role="shape"]' },
  "node.graph-focused": { shape: ".graph-focused:is(rect, polygon, ellipse)" },
  "edge.graph-focused": { edge: ".graph-focused:is(line, path)" },
}

/** Install/update one artifact-scoped stylesheet. No per-frame DOM walk or source mutation. */
export function applySvgStyle(svg: SVGSVGElement, palette: GraphStyle): void {
  const id = styleIds.get(svg) ?? `grapht-style-${++nextStyleId}`
  styleIds.set(svg, id)
  svg.setAttribute("data-grapht-styled", id)
  let sheet = svg.querySelector<SVGStyleElement>(":scope > style[data-grapht-style]")
  if (!sheet) {
    sheet = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "style")
    sheet.setAttribute("data-grapht-style", "")
    svg.appendChild(sheet)
  }
  const rules: string[] = []
  const emit = (selectors: string | undefined, properties: Record<string, unknown>) => {
    if (!selectors) return
    const declarations = Object.entries(properties).filter(([, value]) => typeof value === "string" || typeof value === "number")
    if (!declarations.length) return
    rules.push(`${selectors.split(/, (?![^()]*\))/).map(selector => `[data-grapht-styled="${id}"] ${selector}`).join(", ")} { ${declarations.map(([name, value]) => `${name}: ${value} !important`).join("; ")} }`)
  }
  for (const rule of graphStylesheet(palette)) {
    const role = SVG_ROLES[rule.selector]
    if (!role) continue
    const s = rule.style
    emit(role.shape, { fill: s.backgroundColor, stroke: s.borderColor, "stroke-width": s.borderWidth })
    emit(role.text, { fill: s.color })
    emit(role.edge, { stroke: s.lineColor, "stroke-width": s.width })
    emit(role.arrow, { fill: s.targetArrowColor ?? s.lineColor, stroke: s.targetArrowColor ?? s.lineColor })
  }
  emit('.actor-line, [data-graph-role="lifeline"]', { stroke: palette.lifelineBackground, "stroke-width": 1, "vector-effect": "non-scaling-stroke" })
  emit(".labelBox", { fill: palette.group.fill, stroke: palette.group.stroke })
  emit(".loopText, .loopText tspan, .labelText", { fill: palette.group.text })
  emit(".d2-svg text, .d2-svg tspan", { fill: palette.nodeText })
  emit(".d2-svg .connection ~ text", { fill: palette.edgeText })
  emit(".d2-svg > rect:first-child", { fill: palette.canvasBackground })
  sheet.textContent = rules.join("\n")
}
