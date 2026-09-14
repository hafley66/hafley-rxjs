// A bounded interactive group-layout experiment using Cytoscape's grid layout and shared graph styles.
import cytoscape from "cytoscape"
import { graphStylesheet } from "../../../src/lib/1_graphStylesheet.js"
import { graphStyleOf, type GraphStyleInput } from "../../../src/lib/0_graphStyle.js"
import { groupAllowsAutoLayout, groupPositionsOf, reduceGroupLayout, type GroupLayoutEvent, type GroupLayoutState } from "../../../src/2_graph/15_groupLayout.js"

export function createGroupLayoutLab(host: HTMLElement, theme: GraphStyleInput) {
  const el = document.createElement("section")
  el.dataset.layoutLab = ""
  el.style.cssText = "position:fixed;left:12px;bottom:40px;z-index:12;padding:12px;background:#0b1220;border:1px solid #64748b;color:#e2e8f0"
  el.innerHTML = `<div>Group layout lab: drag a node, then collapse / expand.</div><label><input type="checkbox" data-auto-expand>auto layout on expand</label> <button data-collapse="a">collapse A</button> <button data-collapse="b">collapse B</button> <button data-relayout>auto layout</button> <button data-close>close</button><div data-canvas style="width:560px;height:260px"></div><output data-policy></output>`
  host.append(el)
  const canvas = el.querySelector<HTMLElement>("[data-canvas]")!
  const cy = cytoscape({ container: canvas, style: graphStylesheet(graphStyleOf(theme)) as any, elements: [
    ...["a", "b"].map(id => ({ data: { id, label: id.toUpperCase() } })),
    ...["a", "b"].flatMap(group => [0, 1, 2].map(index => ({ data: { id: `${group}${index}`, parent: group, label: `${group.toUpperCase()}${index}` } }))),
  ], layout: { name: "preset" }, userZoomingEnabled: false, userPanningEnabled: false, boxSelectionEnabled: false })
  const model = { state: { autoOnExpand: false, groups: {} } as GroupLayoutState }
  const children = new Map(["a", "b"].map(group => [group, cy.$id(group).children().jsons()]))
  const output = el.querySelector<HTMLOutputElement>("[data-policy]")!
  const paint = () => {
    output.textContent = ["a", "b"].map(id => `${id.toUpperCase()}: ${model.state.groups[id]?.collapsed ? "collapsed" : groupAllowsAutoLayout(model.state, id) ? "automatic" : "manual"}`).join(" · ")
    for (const button of el.querySelectorAll<HTMLButtonElement>("[data-collapse]")) button.textContent = `${model.state.groups[button.dataset.collapse!]?.collapsed ? "expand" : "collapse"} ${button.dataset.collapse!.toUpperCase()}`
  }
  const send = (event: GroupLayoutEvent) => { model.state = reduceGroupLayout(model.state, event); paint() }
  const layout = (id: string) => {
    if (!groupAllowsAutoLayout(model.state, id) || model.state.groups[id]?.collapsed) return
    cy.$id(id).children().layout({ name: "grid", rows: 2, cols: 2, boundingBox: { x1: id === "a" ? 40 : 320, y1: 60, w: 180, h: 150 }, fit: false, animate: false }).run()
  }
  const beforeDrag = new Map<string, string>()
  const onGrab = (event: cytoscape.EventObject) => {
    const node = event.target
    const id = node.isParent() ? node.id() : node.parent().id()
    if (id) beforeDrag.set(id, JSON.stringify(cy.$id(id).children().map(child => [child.id(), child.position()])))
  }
  const onFree = (event: cytoscape.EventObject) => {
    const node = event.target
    const id = node.isParent() ? node.id() : node.parent().id()
    if (!id || model.state.groups[id]?.collapsed) return
    const previous = beforeDrag.get(id)
    beforeDrag.delete(id)
    if (previous === JSON.stringify(cy.$id(id).children().map(child => [child.id(), child.position()]))) return
    send({ type: "manual-move", groupId: id, positions: Object.fromEntries(cy.$id(id).children().map(child => [child.id(), { ...child.position() }])) })
  }
  cy.on("grab", "node", onGrab)
  cy.on("free", "node", onFree)
  const onClick = (event: Event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button")
    if (!button) return
    if (button.hasAttribute("data-close")) { el.hidden = true; return }
    if (button.hasAttribute("data-relayout")) { for (const id of ["a", "b"]) layout(id); return }
    const id = button.dataset.collapse
    if (!id) return
    if (!model.state.groups[id]?.collapsed) {
      send({ type: "collapse", groupId: id })
      cy.$id(id).children().remove()
      cy.$id(id).layout({ name: "grid", boundingBox: { x1: id === "a" ? 40 : 320, y1: 60, w: 180, h: 150 }, fit: false, animate: false }).run()
    } else {
      send({ type: "expand", groupId: id })
      cy.add(children.get(id)!)
      if (groupAllowsAutoLayout(model.state, id)) layout(id)
      else {
        const saved = groupPositionsOf(model.state, id, {})
        cy.batch(() => { for (const [child, position] of Object.entries(saved)) cy.$id(child).position(position) })
      }
    }
  }
  const toggle = el.querySelector<HTMLInputElement>("[data-auto-expand]")!
  const onChange = () => send({ type: "auto-on-expand", enabled: toggle.checked })
  el.addEventListener("click", onClick)
  toggle.addEventListener("change", onChange)
  for (const id of ["a", "b"]) layout(id)
  cy.viewport({ zoom: 1, pan: { x: 0, y: 0 } })
  paint()
  return { el, cy, model,
    applyTheme(next: GraphStyleInput) { const palette = graphStyleOf(next); canvas.style.background = palette.canvasBackground; cy.style(graphStylesheet(palette) as any) },
    unsubscribe() { cy.destroy(); el.removeEventListener("click", onClick); toggle.removeEventListener("change", onChange); el.remove() },
  }
}
