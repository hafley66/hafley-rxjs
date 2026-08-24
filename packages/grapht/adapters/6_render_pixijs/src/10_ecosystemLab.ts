import "@pixi/layout"

import { SVGScene } from "@pixi-essentials/svg"
import { LayoutContainer } from "@pixi/layout/components"
import { Button } from "@pixi/ui"
import {
  Application,
  Container,
  CullerPlugin,
  DOMContainer,
  Graphics,
  Rectangle,
  Text,
  extensions,
} from "pixi.js"
import { Viewport } from "pixi-viewport"
import { createPixiPinnedViewportRow, createPixiStickyViewportStack } from "./12_stickyViewport.js"

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 900" width="1000" height="900">
  <rect width="1000" height="900" fill="#121a27"/>
  <g id="group-frame" data-role="group-frame">
    <rect x="80" y="180" width="840" height="610" fill="#182334" stroke="#526a8e" stroke-width="3"/>
    <text id="group-label" data-role="group-label" x="105" y="220" fill="#b9c9df" font-family="system-ui" font-size="24" font-weight="600">request lifecycle</text>
  </g>
  <g id="nested-group-frame" data-role="group-frame">
    <rect x="120" y="245" width="760" height="480" fill="none" stroke="#384d6d" stroke-width="2"/>
    <text id="nested-group-label" data-role="group-label" data-depth="1" data-boundary-bottom="725" x="145" y="275" fill="#8fa8ca" font-family="system-ui" font-size="21" font-weight="600">database lookup</text>
  </g>
  <g id="actor-client" data-role="actor">
    <rect x="95" y="55" width="190" height="72" fill="#203555" stroke="#57a5ff" stroke-width="3"/>
    <text x="190" y="99" text-anchor="middle" fill="#eef5ff" font-family="system-ui" font-size="23" font-weight="600">Client</text>
  </g>
  <g id="actor-api" data-role="actor">
    <rect x="405" y="55" width="190" height="72" fill="#332956" stroke="#a78bfa" stroke-width="3"/>
    <text x="500" y="99" text-anchor="middle" fill="#f4efff" font-family="system-ui" font-size="23" font-weight="600">API</text>
  </g>
  <g id="actor-db" data-role="actor">
    <rect x="715" y="55" width="190" height="72" fill="#173e39" stroke="#34d399" stroke-width="3"/>
    <text x="810" y="99" text-anchor="middle" fill="#eafff8" font-family="system-ui" font-size="23" font-weight="600">Database</text>
  </g>
  <g stroke="#50627d" stroke-width="3" stroke-dasharray="10 9">
    <line id="lifeline-client" data-role="lifeline" x1="190" y1="127" x2="190" y2="750"/>
    <line id="lifeline-api" data-role="lifeline" x1="500" y1="127" x2="500" y2="750"/>
    <line id="lifeline-db" data-role="lifeline" x1="810" y1="127" x2="810" y2="750"/>
  </g>
  <g id="message-request" data-role="message">
    <line x1="190" y1="295" x2="486" y2="295" stroke="#57a5ff" stroke-width="4"/>
    <polygon points="500,295 480,284 480,306" fill="#57a5ff"/>
    <text x="345" y="278" text-anchor="middle" fill="#dbeafe" font-family="system-ui" font-size="22">POST /review</text>
  </g>
  <g id="activation-api" data-role="activation">
    <rect x="488" y="295" width="24" height="300" fill="#473873" stroke="#a78bfa" stroke-width="3"/>
  </g>
  <g id="message-query" data-role="message">
    <line x1="512" y1="405" x2="796" y2="405" stroke="#a78bfa" stroke-width="4"/>
    <polygon points="810,405 790,394 790,416" fill="#a78bfa"/>
    <text x="655" y="388" text-anchor="middle" fill="#ede9fe" font-family="system-ui" font-size="22">lookup review</text>
  </g>
  <g id="message-result" data-role="message">
    <line x1="810" y1="505" x2="526" y2="505" stroke="#34d399" stroke-width="4" stroke-dasharray="9 7"/>
    <polygon points="512,505 532,494 532,516" fill="#34d399"/>
    <text x="655" y="488" text-anchor="middle" fill="#d1fae5" font-family="system-ui" font-size="22">review row</text>
  </g>
  <g id="note-cache" data-role="note">
    <rect x="620" y="620" width="235" height="82" fill="#4a3b18" stroke="#f59e0b" stroke-width="3"/>
    <text x="738" y="654" text-anchor="middle" fill="#fff3c4" font-family="system-ui" font-size="20">
      <tspan x="738">cached for</tspan><tspan x="738" dy="25">30 seconds</tspan>
    </text>
  </g>
</svg>`

const host = document.querySelector<HTMLElement>("#ecosystem")
const receipt = document.querySelector<HTMLOutputElement>("#receipt")
if (!host || !receipt) throw new Error("ecosystem lab mount missing")
const mount = host
const output = receipt

extensions.add(CullerPlugin)
const app = new Application()
await app.init({
  preference: "webgl",
  autoStart: false,
  resizeTo: mount,
  antialias: true,
  resolution: Math.min(devicePixelRatio, 2),
  autoDensity: true,
  background: 0x10151f,
})
app.ticker.maxFPS = 60
mount.append(app.canvas)

const viewport = new Viewport({
  screenWidth: app.screen.width,
  screenHeight: app.screen.height,
  worldWidth: 1000,
  worldHeight: 900,
  events: app.renderer.events,
  ticker: app.ticker,
})
viewport.drag().pinch().wheel({ smooth: 3 }).decelerate().clampZoom({ minScale: 0.35, maxScale: 3 })
app.stage.addChild(viewport)

const documentRoot = new DOMParser().parseFromString(SVG, "image/svg+xml").documentElement as unknown as SVGSVGElement
const measureContext = document.createElement("canvas").getContext("2d")
if (!measureContext) throw new Error("canvas text measurement unavailable")
const scene = new SVGScene(documentRoot)
const elementNodes = (scene as unknown as { _elementToRenderNode: Map<SVGElement, Container> })._elementToRenderNode
await new Promise<void>(resolve => setTimeout(resolve, 0))
const textNodes: Text[] = []
for (const element of documentRoot.querySelectorAll<SVGTextElement>("text")) {
  const svgNode = elementNodes.get(element)
  const parentNode = element.parentElement ? elementNodes.get(element.parentElement as unknown as SVGElement) : undefined
  if (!svgNode || !parentNode) continue
  svgNode.renderable = false
  const tspans = [...element.querySelectorAll("tspan")]
  const content = tspans.length ? tspans.map(tspan => tspan.textContent ?? "").join("\n") : element.textContent?.trim() ?? ""
  const fontSize = Number(element.getAttribute("font-size") ?? 16)
  const text = new Text({
    text: content,
    resolution: app.renderer.resolution,
    style: {
      fill: element.getAttribute("fill") ?? "black",
      fontFamily: element.getAttribute("font-family") ?? "sans-serif",
      fontSize,
      fontWeight: (element.getAttribute("font-weight") ?? "normal") as "normal" | "bold" | "bolder" | "lighter" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900",
      lineHeight: tspans.length > 1 ? Number(tspans[1].getAttribute("dy") ?? fontSize * 1.2) : undefined,
    },
  })
  text.anchor.set(element.getAttribute("text-anchor") === "middle" ? 0.5 : 0, 1)
  text.position.set(Number(element.getAttribute("x") ?? 0), Number(element.getAttribute("y") ?? 0))
  parentNode.addChild(text)
  elementNodes.set(element, text)
  textNodes.push(text)
}
scene.cullable = true
scene.cullArea = new Rectangle(0, 0, 1000, 900)
viewport.addChild(scene)
scene.drawPaints(app.renderer)
viewport.fitWorld(true)

const actorLayer = new Container()
const groupLabelLayer = new Container()
app.stage.addChild(groupLabelLayer, actorLayer)
const actorElements = [...documentRoot.querySelectorAll<SVGElement>("[data-role='actor']")]
for (const element of actorElements) {
  const node = elementNodes.get(element)
  if (node) actorLayer.addChild(node)
}
const pinnedActors = createPixiPinnedViewportRow({
  viewport,
  layer: actorLayer,
  worldTop: 55,
  screenTop: 74,
})
const stickyGroupItems = [...documentRoot.querySelectorAll<SVGTextElement>("[data-role='group-label']")].map((element, index) => {
  const node = elementNodes.get(element)!
  const bounds = node.getLocalBounds()
  const baseline = Number(element.getAttribute("y"))
  const worldTop = baseline + bounds.y
  groupLabelLayer.addChild(node)
  return {
    id: element.id,
    node,
    worldTop,
    boundaryWorldBottom: Number(element.dataset.boundaryBottom ?? 790),
    localTop: bounds.y,
    height: bounds.height,
    order: Number(element.dataset.depth ?? index),
  }
})
const stickyGroups = createPixiStickyViewportStack({
  viewport,
  layer: groupLabelLayer,
  items: stickyGroupItems,
  inset: () => 74 + 72 * viewport.scale.x + 8,
  gap: 6,
})
const recordStickyState = () => {
  mount.dataset.stickyGroupStates = stickyGroups.receipt().map(item => `${item.id}:${item.state}`).join(",")
}
viewport.on("moved", recordStickyState)
viewport.on("zoomed", recordStickyState)
recordStickyState()

const roleCounts = new Map<string, number>()
for (const [element, node] of elementNodes) {
  const role = element.getAttribute("data-role")
  if (!role) continue
  roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1)
  if (role === "group-frame") continue
  const hoverIn = () => {
    node.alpha = 0.62
    output.value = `hover ${role}: ${element.id}`
    mount.dataset.hoveredRole = role
    mount.dataset.hoveredId = element.id
    app.render()
  }
  const hoverOut = () => {
    node.alpha = 1
    app.render()
  }
  const targetNodes: Container[] = []
  if (role === "message") {
    const line = element.querySelector("line")
    const label = element.querySelector("text")
    const hitOverlay = new Graphics()
    if (line) {
      const x1 = Number(line.getAttribute("x1"))
      const x2 = Number(line.getAttribute("x2"))
      const y = Number(line.getAttribute("y1"))
      hitOverlay.rect(Math.min(x1, x2) - 8, y - 8, Math.abs(x2 - x1) + 16, 16)
    }
    if (label) {
      const fontSize = Number(label.getAttribute("font-size") ?? 16)
      measureContext.font = `${label.getAttribute("font-weight") ?? "normal"} ${fontSize}px ${label.getAttribute("font-family") ?? "sans-serif"}`
      const width = measureContext.measureText(label.textContent ?? "").width
      const x = Number(label.getAttribute("x"))
      const y = Number(label.getAttribute("y"))
      hitOverlay.rect(x - 6, y - fontSize - 6, width + 12, fontSize + 12)
    }
    hitOverlay.fill({ color: 0xffffff, alpha: 0.001 })
    node.addChild(hitOverlay)
    targetNodes.push(hitOverlay)
  } else {
    targetNodes.push(node)
  }
  for (const targetNode of targetNodes) {
    targetNode.eventMode = "static"
    targetNode.cursor = "pointer"
    targetNode.on("pointerover", hoverIn)
    targetNode.on("pointerout", hoverOut)
  }
}

const toolbar = new LayoutContainer()
toolbar.position.set(12, 12)
toolbar.layout = {
  width: 570,
  height: 48,
  padding: 7,
  gap: 8,
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: 0x172234,
  borderColor: 0x42536d,
  borderWidth: 1,
  borderRadius: 8,
}
app.stage.addChild(toolbar)

const fitView = new Graphics().roundRect(0, 0, 92, 32, 6).fill(0x29466d).stroke({ color: 0x68a7ef, width: 1 })
fitView.layout = { width: 92, height: 32 }
const fitLabel = new Text({ text: "Fit SVG", style: { fill: 0xe7f2ff, fontFamily: "system-ui", fontSize: 14, fontWeight: "600" } })
fitLabel.anchor.set(0.5)
fitLabel.position.set(46, 16)
fitView.addChild(fitLabel)
const fitButton = new Button(fitView)
let fitCount = 0
fitButton.onPress.connect(() => {
  viewport.fitWorld(true)
  pinnedActors.layout()
  stickyGroups.layout()
  recordStickyState()
  app.render()
  fitCount += 1
  mount.dataset.fitCount = String(fitCount)
})
toolbar.addChild(fitView)

const toolViews = new Map<string, Graphics>()
const toolWidths = new Map<string, number>()
const selectTool = (selected: string) => {
  for (const [label, view] of toolViews) {
    view.clear().roundRect(0, 0, toolWidths.get(label)!, 32, 5)
      .fill(label === selected ? 0x31517b : 0x202d40)
      .stroke({ color: label === selected ? 0x68a7ef : 0x2a3a50, width: 1 })
  }
  mount.dataset.activeTool = selected
  output.value = `toolbar: ${selected}`
  app.render()
}

for (const label of ["SVGScene", "viewport", "layout", "UI", "culler"]) {
  const width = label.length * 8 + 18
  const view = new Graphics().roundRect(0, 0, width, 32, 5).fill(0x202d40)
  view.layout = { width, height: 32 }
  toolViews.set(label, view)
  toolWidths.set(label, width)
  const text = new Text({ text: label, style: { fill: 0xaec3de, fontFamily: "system-ui", fontSize: 13 } })
  text.anchor.set(0.5)
  text.position.set(width / 2, 16)
  view.addChild(text)
  const button = new Button(view)
  button.onPress.connect(() => selectTool(label))
  toolbar.addChild(view)
}
selectTool("SVGScene")

const badgeElement = document.createElement("div")
badgeElement.className = "pixi-dom-badge"
badgeElement.textContent = "DOMContainer: live HTML"
const badge = new DOMContainer({ element: badgeElement })
badge.position.set(app.screen.width - 150, 28)
app.stage.addChild(badge)

let stopTimer = 0
const startRendering = () => {
  clearTimeout(stopTimer)
  app.start()
  mount.dataset.tickerStarted = String(app.ticker.started)
}
const stopRenderingSoon = () => {
  clearTimeout(stopTimer)
  stopTimer = window.setTimeout(() => {
    app.stop()
    mount.dataset.tickerStarted = String(app.ticker.started)
  }, 500)
}
app.canvas.addEventListener("pointerdown", startRendering)
app.canvas.addEventListener("wheel", startRendering, { passive: true })
window.addEventListener("pointerup", stopRenderingSoon)
viewport.on("moved-end", stopRenderingSoon)
viewport.on("zoomed-end", stopRenderingSoon)
viewport.on("zoomed-end", () => {
  const resolution = Math.max(app.renderer.resolution, Math.min(4, app.renderer.resolution * viewport.scale.x))
  for (const text of textNodes) text.resolution = resolution
  mount.dataset.textResolution = resolution.toFixed(2)
  app.render()
})
window.addEventListener("resize", () => app.render())

app.render()
app.stop()
mount.dataset.tickerStarted = String(app.ticker.started)
mount.dataset.textResolution = String(app.renderer.resolution.toFixed(2))
await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

const counts = Object.fromEntries([...roleCounts.entries()].sort(([left], [right]) => left.localeCompare(right)))
const result = {
  pixiBackend: app.renderer.type,
  svgElementNodes: elementNodes.size,
  roles: counts,
  viewportPlugins: ["drag", "pinch", "wheel", "decelerate", "clampZoom"],
  layout: Boolean(toolbar.layout),
  uiButton: Boolean(fitButton.view),
  cullable: scene.cullable,
  domContainer: badgeElement.isConnected,
  stickyActors: actorElements.length,
  stickyGroups: stickyGroupItems.length,
}
output.value = JSON.stringify(result, null, 2)
mount.dataset.ready = "true"
mount.dataset.svgElementNodes = String(result.svgElementNodes)
mount.dataset.viewportPlugins = result.viewportPlugins.join(",")
mount.dataset.layout = String(result.layout)
mount.dataset.uiButton = String(result.uiButton)
mount.dataset.cullable = String(result.cullable)
mount.dataset.domContainer = String(result.domContainer)
mount.dataset.fitCount = String(fitCount)
mount.dataset.stickyActors = String(result.stickyActors)
mount.dataset.stickyGroups = String(result.stickyGroups)
