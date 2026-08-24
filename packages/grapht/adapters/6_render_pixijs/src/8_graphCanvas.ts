import { Application, Container, Graphics, Rectangle, Text, TextStyle, type FederatedPointerEvent } from "pixi.js"

type NodeModel = { id: string; label: string; x: number; y: number; color: number }
type EdgeModel = { source: string; target: string }

const nodes: NodeModel[] = [
  { id: "source", label: "Source", x: 0, y: 130, color: 0x57a5ff },
  { id: "parse", label: "Parse", x: 210, y: 40, color: 0xa78bfa },
  { id: "identify", label: "Identity", x: 210, y: 220, color: 0xa78bfa },
  { id: "artifact", label: "Artifact", x: 440, y: 130, color: 0xf59e0b },
  { id: "mermaid", label: "Mermaid SVG", x: 680, y: 35, color: 0x34d399 },
  { id: "d2", label: "D2 SVG", x: 680, y: 145, color: 0x34d399 },
  { id: "pixi", label: "Pixi canvas", x: 680, y: 255, color: 0x38bdf8 },
  { id: "board", label: "Interactive board", x: 920, y: 130, color: 0xfb7185 },
]

const edges: EdgeModel[] = [
  { source: "source", target: "parse" },
  { source: "source", target: "identify" },
  { source: "parse", target: "artifact" },
  { source: "identify", target: "artifact" },
  { source: "artifact", target: "mermaid" },
  { source: "artifact", target: "d2" },
  { source: "artifact", target: "pixi" },
  { source: "mermaid", target: "board" },
  { source: "d2", target: "board" },
  { source: "pixi", target: "board" },
]

const host = document.querySelector<HTMLElement>("#graph")
const state = document.querySelector<HTMLOutputElement>("#state")
const fitButton = document.querySelector<HTMLButtonElement>("#fit")
if (!host || !state || !fitButton) throw new Error("graph canvas mount missing")
const graphHost = host
const stateOutput = state
const fitControl = fitButton

const app = new Application()
await app.init({
  preference: "webgl",
  resizeTo: graphHost,
  antialias: true,
  autoDensity: true,
  resolution: Math.min(devicePixelRatio, 2),
  background: 0x10151f,
})
graphHost.append(app.canvas)

const camera = new Container()
const edgeLayer = new Container()
const nodeLayer = new Container()
camera.addChild(edgeLayer, nodeLayer)
app.stage.addChild(camera)
app.stage.eventMode = "static"
app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height)

const byId = new Map(nodes.map(node => [node.id, node]))
const views = new Map<string, Container>()
let selectedId: string | undefined
let hoveredId: string | undefined
let hoveredEdge: EdgeModel | undefined
let softHoveredIds = new Set<string>()

const textStyle = new TextStyle({ fontFamily: "system-ui, sans-serif", fontSize: 15, fontWeight: "600", fill: 0xe6edf3 })

function reachableFrom(startId: string, includeStart: boolean): Set<string> {
  const reached = new Set<string>(includeStart ? [startId] : [])
  const queue = [startId]
  for (let index = 0; index < queue.length; index++) {
    for (const edge of edges) {
      if (edge.source !== queue[index] || reached.has(edge.target)) continue
      reached.add(edge.target)
      queue.push(edge.target)
    }
  }
  return reached
}

function repaintNodes(): void {
  for (const view of views.values()) view.emit("graph-repaint")
  graphHost.dataset.softHoveredNodes = [...softHoveredIds].sort().join(",")
}

function setNodeHover(nodeId: string | undefined): void {
  hoveredId = nodeId
  hoveredEdge = undefined
  softHoveredIds = nodeId ? reachableFrom(nodeId, false) : new Set()
  repaintNodes()
}

function setEdgeHover(edge: EdgeModel | undefined): void {
  hoveredId = undefined
  hoveredEdge = edge
  softHoveredIds = edge ? reachableFrom(edge.target, true) : new Set()
  repaintNodes()
}

function drawEdges(): void {
  edgeLayer.removeChildren()
  for (const edge of edges) {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) continue
    const view = new Container({ label: `${edge.source}->${edge.target}` })
    const visible = new Graphics()
    const hit = new Graphics()
    const startX = source.x + 70
    const endX = target.x - 70
    const bend = Math.max(30, (endX - startX) * 0.5)
    const path = (graphics: Graphics): Graphics => graphics
      .moveTo(startX, source.y)
      .bezierCurveTo(startX + bend, source.y, endX - bend, target.y, endX, target.y)
    path(visible).stroke({ width: hoveredEdge === edge ? 3 : 2, color: hoveredEdge === edge ? 0x8fb9ec : 0x52647d, alpha: 0.9 })
    path(hit).stroke({ width: 16, color: 0xffffff, alpha: 0.001 })
    visible.poly([endX, target.y, endX - 10, target.y - 6, endX - 10, target.y + 6]).fill({ color: 0x7186a3 })
    hit.eventMode = "static"
    hit.cursor = "pointer"
    hit.on("pointerover", () => { setEdgeHover(edge); stateOutput.value = `edge: ${edge.source} → ${edge.target}`; drawEdges() })
    hit.on("pointerout", () => { setEdgeHover(undefined); stateOutput.value = selectedId ? `selected: ${selectedId}` : ""; drawEdges() })
    view.addChild(visible, hit)
    edgeLayer.addChild(view)
  }
}

function drawNode(node: NodeModel): Container {
  const view = new Container({ label: node.id })
  const shape = new Graphics()
  const label = new Text({ text: node.label, style: textStyle })
  label.anchor.set(0.5)
  view.addChild(shape, label)
  view.position.set(node.x, node.y)
  view.eventMode = "static"
  view.cursor = "grab"
  view.hitArea = { contains: (x: number, y: number) => Math.abs(x) <= 70 && Math.abs(y) <= 25 }

  const paint = (): void => {
    const selected = selectedId === node.id
    const hovered = hoveredId === node.id
    const softHovered = softHoveredIds.has(node.id)
    shape.clear().roundRect(-70, -25, 140, 50, 10)
    shape.fill({ color: selected ? 0x263d61 : softHovered ? 0x213149 : 0x192334 })
    shape.stroke({ width: selected ? 4 : hovered ? 3 : softHovered ? 2.5 : 2, color: node.color, alpha: softHovered ? 0.9 : 1 })
    view.scale.set(hovered ? 1.04 : 1)
    view.alpha = softHovered ? 0.88 : 1
  }

  view.on("pointerover", () => { setNodeHover(node.id); stateOutput.value = `hover: ${node.id}` })
  view.on("pointerout", () => { setNodeHover(undefined); stateOutput.value = selectedId ? `selected: ${selectedId}` : "" })
  view.on("pointertap", event => {
    event.stopPropagation()
    const previous = selectedId
    selectedId = selectedId === node.id ? undefined : node.id
    if (previous) views.get(previous)?.emit("graph-repaint")
    paint()
    stateOutput.value = selectedId ? `selected: ${selectedId}` : ""
  })
  view.on("graph-repaint", paint)
  view.on("pointerdown", event => {
    event.stopPropagation()
    view.cursor = "grabbing"
    const start = event.global.clone()
    const origin = { x: node.x, y: node.y }
    const move = (moveEvent: FederatedPointerEvent): void => {
      node.x = origin.x + (moveEvent.global.x - start.x) / camera.scale.x
      node.y = origin.y + (moveEvent.global.y - start.y) / camera.scale.y
      view.position.set(node.x, node.y)
      drawEdges()
      graphHost.dataset.draggedNode = node.id
      graphHost.dataset.draggedNodeX = String(node.x)
      graphHost.dataset.draggedNodeY = String(node.y)
    }
    const end = (): void => {
      view.cursor = "grab"
      app.stage.off("globalpointermove", move)
      window.removeEventListener("pointerup", end)
    }
    app.stage.on("globalpointermove", move)
    window.addEventListener("pointerup", end, { once: true })
  })
  paint()
  return view
}

for (const node of nodes) {
  const view = drawNode(node)
  views.set(node.id, view)
  nodeLayer.addChild(view)
}
drawEdges()

function fit(): void {
  const bounds = camera.getLocalBounds()
  const padding = 80
  const scale = Math.min((app.screen.width - padding * 2) / bounds.width, (app.screen.height - padding * 2) / bounds.height, 1.5)
  camera.scale.set(scale)
  camera.position.set(
    (app.screen.width - bounds.width * scale) / 2 - bounds.x * scale,
    (app.screen.height - bounds.height * scale) / 2 - bounds.y * scale,
  )
}

fit()
fitControl.addEventListener("click", fit)

graphHost.addEventListener("wheel", event => {
  event.preventDefault()
  const rect = graphHost.getBoundingClientRect()
  const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  const world = camera.toLocal(point)
  const nextScale = Math.min(3, Math.max(0.25, camera.scale.x * Math.exp(-event.deltaY * 0.0015)))
  camera.scale.set(nextScale)
  const moved = camera.toGlobal(world)
  camera.position.x += point.x - moved.x
  camera.position.y += point.y - moved.y
}, { passive: false })

app.stage.on("pointerdown", event => {
  if (event.target !== app.stage) return
  const start = event.global.clone()
  const origin = { x: camera.position.x, y: camera.position.y }
  app.canvas.style.cursor = "grabbing"
  const move = (moveEvent: FederatedPointerEvent): void => {
    camera.position.set(origin.x + moveEvent.global.x - start.x, origin.y + moveEvent.global.y - start.y)
    graphHost.dataset.cameraX = String(camera.position.x)
    graphHost.dataset.cameraY = String(camera.position.y)
  }
  const end = (): void => {
    app.canvas.style.cursor = "default"
    app.stage.off("globalpointermove", move)
    window.removeEventListener("pointerup", end)
  }
  app.stage.on("globalpointermove", move)
  window.addEventListener("pointerup", end, { once: true })
})

graphHost.dataset.ready = "true"
graphHost.dataset.nodeCount = String(nodes.length)
graphHost.dataset.edgeCount = String(edges.length)
graphHost.dataset.cameraX = String(camera.position.x)
graphHost.dataset.cameraY = String(camera.position.y)
graphHost.dataset.softHoveredNodes = ""
