import Graph from "graphology"
import Sigma from "sigma"
import type { Geometry } from "./0_protocol.js"
import { buildGraph } from "./1_graphology.js"

export type CameraState = { x: number; y: number; angle: number; ratio: number }

export type ProjectionOptions = {
  renderLabels?: boolean
  minCameraRatio?: number | null
  maxCameraRatio?: number | null
  zoomDuration?: number
}

export class SigmaProjection {
  readonly sigma: Sigma
  readonly graph: Graph
  selectedNode: string | null = null

  constructor(
    readonly container: HTMLElement,
    graph: Graph,
    options: ProjectionOptions = {},
  ) {
    this.graph = graph
    this.sigma = new Sigma(graph, container, {
      renderLabels: options.renderLabels ?? true,
      renderEdgeLabels: false,
      enableCameraZooming: true,
      enableCameraPanning: true,
      enableCameraRotation: false,
      minCameraRatio: options.minCameraRatio ?? 0.001,
      maxCameraRatio: options.maxCameraRatio ?? 4,
      zoomDuration: options.zoomDuration ?? 300,
      labelRenderedSizeThreshold: 12,
    })
    this.sigma.on("clickNode", ({ node }) => {
      this.selectedNode = node
    })
  }

  async settleFrames(frames = 2): Promise<void> {
    for (let i = 0; i < frames; i++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }
  }

  async firstRender(): Promise<void> {
    this.sigma.refresh()
    await this.settleFrames(4)
  }

  async zoom(factor: number): Promise<void> {
    await this.sigma.getCamera().animatedZoom({ factor, duration: 200 })
    this.sigma.refresh()
    await this.settleFrames(2)
  }

  async panBy(dx: number, dy: number): Promise<void> {
    const camera = this.sigma.getCamera()
    const state = camera.getState()
    camera.animate({ x: state.x + dx, y: state.y + dy }, { duration: 200 })
    await new Promise<void>(resolve => setTimeout(() => resolve(), 250))
    this.sigma.refresh()
    await this.settleFrames(2)
  }

  readCamera(): CameraState {
    return this.sigma.getCamera().getState()
  }

  resetCamera(): void {
    this.sigma.getCamera().animatedReset({ duration: 1 })
    this.sigma.refresh()
  }

  screenPoint(nodeId: string): { x: number; y: number } | null {
    const data = this.sigma.getNodeDisplayData(nodeId)
    if (!data) return null
    const p = this.sigma.framedGraphToViewport({ x: data.x, y: data.y })
    const containerRect = this.container.getBoundingClientRect()
    return { x: containerRect.left + p.x, y: containerRect.top + p.y }
  }

  currentNodeCount(): number {
    return this.graph.order
  }

  currentEdgeCount(): number {
    return this.graph.size
  }

  replace(geometry: Geometry): void {
    const replacement = buildGraph(geometry)
    this.graph.clear()
    replacement.forEachNode((node, attributes) => this.graph.addNode(node, { ...attributes }))
    replacement.forEachEdge((edge, attributes, source, target) => this.graph.addUndirectedEdge(source, target, { ...attributes }))
    this.sigma.refresh()
  }

  visibleEdgeCount(): number {
    const dimensions = this.sigma.getDimensions()
    let count = 0
    this.graph.forEachEdge((_edge, _attributes, source, target) => {
      const sourceData = this.graph.getNodeAttributes(source)
      const targetData = this.graph.getNodeAttributes(target)
      const sourcePoint = this.sigma.framedGraphToViewport({ x: sourceData.x, y: sourceData.y })
      const targetPoint = this.sigma.framedGraphToViewport({ x: targetData.x, y: targetData.y })
      const sourceVisible = sourcePoint.x >= 0 && sourcePoint.x <= dimensions.width && sourcePoint.y >= 0 && sourcePoint.y <= dimensions.height
      const targetVisible = targetPoint.x >= 0 && targetPoint.x <= dimensions.width && targetPoint.y >= 0 && targetPoint.y <= dimensions.height
      if (sourceVisible || targetVisible) count++
    })
    return count
  }

  resize(): void {
    this.sigma.resize()
    this.sigma.refresh()
  }

  visibleCount(): number {
    const dimensions = this.sigma.getDimensions()
    let count = 0
    const graph = this.sigma.getGraph()
    graph.forEachNode((node: string) => {
      const data = this.sigma.getNodeDisplayData(node)
      if (!data) return
      const point = this.sigma.framedGraphToViewport({ x: data.x, y: data.y })
      if (point.x >= 0 && point.x <= dimensions.width && point.y >= 0 && point.y <= dimensions.height) {
        count += 1
      }
    })
    return count
  }

  webglInfo(): { contextCreated: boolean; canvasCount: number } {
    const canvases = Object.values(this.sigma.getCanvases())
    return {
      contextCreated: canvases.length > 0,
      canvasCount: canvases.length,
    }
  }

  dispose(): void {
    this.sigma.kill()
  }
}

export function frameRect(nodeCount: number, spacing: number): { x1: number; y1: number; x2: number; y2: number } {
  const side = Math.ceil(Math.sqrt(nodeCount))
  return { x1: 0, y1: 0, x2: side * spacing, y2: side * spacing }
}
