import type { Canvas, CanvasKit, Paint, PathBuilder, Surface } from "canvaskit-wasm"
import type { Geometry } from "./0_protocol.js"
import type { Camera } from "./2_hitTest.js"

declare global {
  interface Window {
    CanvasKitInit?: (opts: { locateFile: (file: string) => string }) => Promise<CanvasKit>
  }
}

export type SceneOptions = {
  canvasId: string
  nodeRadius: number
  selectionNodeRadius: number
}

export type FrameStats = {
  drawMs: number
  flushMs: number
  totalMs: number
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)

export class Scene {
  readonly ck: CanvasKit
  readonly canvas: HTMLCanvasElement
  readonly geometry: Geometry
  readonly opts: SceneOptions
  surface: Surface | null = null
  canvasEl: Canvas | null = null
  camera: Camera = { scale: 1, tx: 0, ty: 0 }
  selectedIndex = -1
  private paints: { node: Paint; edge: Paint; selection: Paint }
  private disposed = false
  hasRendered = false

  constructor(ck: CanvasKit, canvas: HTMLCanvasElement, geometry: Geometry, opts: SceneOptions) {
    this.ck = ck
    this.canvas = canvas
    this.geometry = geometry
    this.opts = opts
    this.paints = {
      node: new ck.Paint(),
      edge: new ck.Paint(),
      selection: new ck.Paint(),
    }
    this.paints.node.setColor(ck.Color4f(0.35, 0.62, 0.92, 1))
    this.paints.edge.setColor(ck.Color4f(0.9, 0.9, 0.92, 0.2))
    this.paints.selection.setColor(ck.Color4f(0.98, 0.62, 0.22, 1))
  }

  attach(): void {
    if (this.surface) return
    this.surface = this.ck.MakeSWCanvasSurface(this.canvas)
    if (!this.surface) throw new Error("MakeSWCanvasSurface returned null")
    this.canvasEl = this.surface.getCanvas()
  }

  setCamera(camera: Camera): void {
    this.camera = camera
  }

  select(index: number): void {
    this.selectedIndex = clamp(index, -1, this.geometry.nodeCount - 1)
  }

  draw(): FrameStats {
    const drawStart = performance.now()
    const ck = this.ck
    const canvas = this.canvasEl
    if (!canvas || !this.surface) throw new Error("scene not attached")
    const { width, height } = this.canvas

    canvas.clear(ck.Color4f(0.072, 0.078, 0.09, 1))
    canvas.save()
    canvas.concat(
      ck.Matrix.multiply(
        ck.Matrix.translated(this.camera.tx, this.camera.ty),
        ck.Matrix.scaled(this.camera.scale, this.camera.scale),
      ),
    )

    const nodeRadius = this.opts.nodeRadius
    const edgePaint = this.paints.edge
    const nodePaint = this.paints.node

    const edgePath: PathBuilder = new ck.PathBuilder()
    for (const [a, b] of this.geometry.edges) {
      const ax = this.geometry.positions[a * 2]
      const ay = this.geometry.positions[a * 2 + 1]
      const bx = this.geometry.positions[b * 2]
      const by = this.geometry.positions[b * 2 + 1]
      edgePath.moveTo(ax, ay)
      edgePath.lineTo(bx, by)
    }
    const edgePathValue = edgePath.detachAndDelete()
    canvas.drawPath(edgePathValue, edgePaint)
    edgePathValue.delete()

    for (let i = 0; i < this.geometry.nodeCount; i++) {
      canvas.drawCircle(this.geometry.positions[i * 2], this.geometry.positions[i * 2 + 1], nodeRadius, nodePaint)
    }

    if (this.selectedIndex >= 0) {
      const sx = this.geometry.positions[this.selectedIndex * 2]
      const sy = this.geometry.positions[this.selectedIndex * 2 + 1]
      canvas.drawCircle(sx, sy, this.opts.selectionNodeRadius, this.paints.selection)
    }
    canvas.restore()

    const drawMs = performance.now() - drawStart
    const flushStart = performance.now()
    this.surface.flush()
    const flushMs = performance.now() - flushStart
    this.hasRendered = true
    return { drawMs, flushMs, totalMs: drawMs + flushMs }
  }

  memoryPages(): number {
    const heap = (this.ck as unknown as { HEAPU8?: { buffer: ArrayBuffer } }).HEAPU8
    if (!heap) return 0
    return Math.round(heap.buffer.byteLength / (64 * 1024))
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.paints.node.delete()
    this.paints.edge.delete()
    this.paints.selection.delete()
    if (this.surface) {
      this.surface.dispose()
      this.surface = null
    }
    this.canvasEl = null
  }
}
