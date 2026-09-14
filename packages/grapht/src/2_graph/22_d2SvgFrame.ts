import type { Graph, SvgBindingRole } from "@hafley66/grapht-model"
import { foreignObjectsToText } from "./13_foreignObjectText.js"
import { svgFrame } from "./21_svgFrame.js"

/** Recover D2 object IDs and endpoint relations from the renderer's base64 group classes.
 * Source layout and source text are retained. Unrecognized connection IDs fail ingestion.
 */
export function d2SvgFrame(document: Document, svg: string, source: string, viewport: { width: number; height: number }) {
  const parsed = new DOMParser().parseFromString(foreignObjectsToText(svg), "image/svg+xml")
  const graph: Record<string, Graph[string]> = {}
  const bindings: { elementId: string; graphId: string; role: SvgBindingRole; ordinal: number }[] = []
  const groups: { element: Element; id: string }[] = []
  for (const element of parsed.querySelectorAll("g[class]")) {
    const encoded = element.getAttribute("class") ?? ""
    try {
      const id = new TextDecoder().decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0))).replaceAll("&gt;", ">").replaceAll("&lt;", "<")
      if (element.querySelector(":scope > g.shape, :scope > path.connection")) groups.push({ element, id })
    } catch { /* D2 also emits ordinary, non-identity CSS classes. */ }
  }
  const bind = (element: Element, graphId: string, role: SvgBindingRole) => {
    element.id ||= `d2-binding-${bindings.length}`
    bindings.push({ elementId: element.id, graphId, role, ordinal: bindings.length })
  }
  for (const { element, id } of groups) {
    const shape = element.querySelector(":scope > g.shape")
    if (!shape) continue
    const text = [...element.querySelectorAll("text")].map(node => node.textContent?.trim()).filter(Boolean).join("\n")
    graph[id] = { id, type: "node", data: { label: text || id } }
    bind(shape, id, "actor-shape")
    for (const label of element.querySelectorAll("text")) bind(label, id, "actor-label")
  }
  for (const id of Object.keys(graph)) {
    const parentId = id.includes(".") ? id.slice(0, id.lastIndexOf(".")) : ""
    if (parentId && graph[parentId]) graph[id] = { ...graph[id], parentId }
  }
  for (const { element, id } of groups) {
    const line = element.querySelector(":scope > path.connection")
    if (!line) continue
    const match = /^(.*?)\((.+?) (<?-+>?) (.*)\)\[\d+\]$/.exec(id)
    const fromId = match ? match[1] + match[2] : ""
    const toId = match ? match[1] + match[4] : ""
    // A sequence diagram draws each actor's lifeline as a connection with no target, `(alice -- )[0]`.
    // It is the actor's own line, so it binds to the actor and adds no edge.
    if (match && match[4] === "" && graph[fromId]) {
      bind(line, fromId, "lifeline")
      continue
    }
    if (!match || !graph[fromId] || !graph[toId]) throw new Error(`Unsupported D2 connection identity: ${id}`)
    graph[id] = { id, type: "edge", fromId, toId, direction: match[3].startsWith("<") && match[3].endsWith(">") ? "both" : match[3].endsWith(">") ? "forward" : "none", data: { label: element.querySelector("text")?.textContent ?? "" } }
    bind(line, id, "message-line")
    for (const label of element.querySelectorAll("text")) bind(label, id, "message-label")
  }
  const frame = svgFrame(document, { svg: new XMLSerializer().serializeToString(parsed), graph, bindings, locator: "0_rendered_artifact_state_epic.d2", rootId: "epic", viewport })
  frame.presentation.sealedSvgArtifactsByRootId.epic.source = { language: "d2", text: source, locator: "0_rendered_artifact_state_epic.d2" }
  return frame
}
