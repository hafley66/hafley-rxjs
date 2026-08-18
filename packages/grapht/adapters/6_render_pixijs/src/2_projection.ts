import {
  Application,
  Container,
  Graphics,
  Mesh,
  MeshGeometry,
  Particle,
  ParticleContainer,
  Sprite,
  Texture,
  WebGLRenderer,
  WebGPURenderer,
  type ContainerChild,
} from "pixi.js"
import type { Geometry } from "@hafley66/grapht"
import { edgeTriangles, fitCamera, panCamera, screenToWorld, worldToScreen, zoomCamera, type CameraState } from "./7_geometryMath.js"

export const NODE_RADIUS = 4
export const EDGE_THICKNESS = 1.5
export const NODE_COLOR = 0x4a7fdf
export const EDGE_COLOR = 0x2a3a55

export type RendererMode = "webgl" | "webgpu"
export type Representation = "retained" | "particles"
export type ActualBackend = RendererMode

export { type CameraState }

export type PixiProjectionOptions = {
  renderer: RendererMode
  representation: Representation
  width?: number
  height?: number
  devicePixelRatio?: number
  backgroundColor?: number
}

export type PixiProjectionInfo = {
  requestedRenderer: RendererMode
  actualBackend: ActualBackend
  rendererInstance: string
  canvasPresent: boolean
  canvasPixels: number
  webgpuAdapter: string | null
  webgpuDevice: string | null
  nodeRepresentation: Representation
  nodeCount: number
  edgeCount: number
  viewWidth: number
  viewHeight: number
  devicePixelRatio: number
}

function makeNodeTexture(renderer: Application["renderer"], radius: number, color: number): Texture {
  const g = new Graphics()
  g.circle(0, 0, radius).fill({ color })
  return renderer.generateTexture({ target: g, resolution: 1 })
}

export class PixiProjection {
  readonly app: Application
  readonly container: HTMLElement
  readonly camera: CameraState = { scale: 1, tx: 0, ty: 0 }

  readonly geometry: Geometry
  readonly representation: Representation
  readonly requestedRenderer: RendererMode

  readonly root = new Container()

  nodeViews: (Graphics | Sprite | Particle)[] = []
  private edgeMesh: Mesh | null = null
  private nodeTexture: Texture | null = null

  private readonly opts: Required<PixiProjectionOptions>

  constructor(container: HTMLElement, geometry: Geometry, options: PixiProjectionOptions) {
    this.container = container
    this.geometry = geometry
    this.representation = options.representation
    this.requestedRenderer = options.renderer
    this.opts = {
      renderer: options.renderer,
      representation: options.representation,
      width: options.width ?? 800,
      height: options.height ?? 600,
      devicePixelRatio: options.devicePixelRatio ?? 1,
      backgroundColor: options.backgroundColor ?? 0x10141c,
    }
    this.app = new Application()
  }

  get viewWidth(): number {
    return this.opts.width
  }

  get viewHeight(): number {
    return this.opts.height
  }

  get devicePixelRatio(): number {
    return this.opts.devicePixelRatio
  }

  get actualBackend(): ActualBackend {
    return this.app.renderer instanceof WebGPURenderer ? "webgpu" : "webgl"
  }

  async init(): Promise<void> {
    await this.app.init({
      preference: this.requestedRenderer,
      antialias: false,
      width: this.viewWidth,
      height: this.viewHeight,
      background: this.opts.backgroundColor,
      resolution: this.devicePixelRatio,
      autoDensity: true,
      hello: false,
    })
    this.container.appendChild(this.app.canvas)
    this.app.ticker.stop()
    this.buildScene()
    this.fitCamera()
  }

  info(): PixiProjectionInfo {
    let webgpuAdapter: string | null = null
    let webgpuDevice: string | null = null
    const gpu = (this.app.renderer as WebGPURenderer).gpu
    if (gpu) {
      const adapterInfo = gpu.adapter?.info
      webgpuAdapter = adapterInfo ? `${adapterInfo.vendor} / ${adapterInfo.architecture} / ${adapterInfo.device}` : "unknown"
      webgpuDevice = gpu.device ? "present" : "absent"
    }
    return {
      requestedRenderer: this.requestedRenderer,
      actualBackend: this.actualBackend,
      rendererInstance: this.actualBackend === "webgpu" ? "WebGPURenderer" : "WebGLRenderer",
      canvasPresent: this.container.querySelector("canvas") !== null,
      canvasPixels: this.viewWidth * this.viewHeight,
      webgpuAdapter,
      webgpuDevice,
      nodeRepresentation: this.representation,
      nodeCount: this.geometry.nodeIds.length,
      edgeCount: this.geometry.edges.length,
      viewWidth: this.viewWidth,
      viewHeight: this.viewHeight,
      devicePixelRatio: this.devicePixelRatio,
    }
  }

  settleFrames(count = 2): Promise<void> {
    const wait = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => resolve()))
    const loop = async (remaining: number): Promise<void> => {
      if (remaining <= 0) return
      await wait()
      return loop(remaining - 1)
    }
    return loop(count)
  }

  render(): void {
    this.app.renderer.render(this.app.stage)
  }

  async firstRender(): Promise<void> {
    this.render()
    await this.settleFrames(4)
  }

  private buildScene(): void {
    this.root.removeChildren()
    const { nodeIds, positions, edges } = this.geometry
    if (this.representation === "particles") {
      const particles = new ParticleContainer()
      this.nodeTexture = makeNodeTexture(this.app.renderer, NODE_RADIUS, NODE_COLOR)
      const particleViews: Particle[] = []
      for (let index = 0; index < nodeIds.length; index++) {
        const particle = new Particle({ texture: this.nodeTexture })
        particle.anchorX = 0.5
        particle.anchorY = 0.5
        particle.scaleX = 1
        particle.scaleY = 1
        particle.x = positions[index * 2]
        particle.y = positions[index * 2 + 1]
        particleViews.push(particle)
      }
      particles.addParticle(...particleViews)
      this.nodeViews = particleViews
      this.root.addChild(particles)

      const triangles = edgeTriangles(positions, edges, EDGE_THICKNESS)
      const geometry = new MeshGeometry({
        positions: triangles.positions,
        uvs: triangles.uvs,
        indices: triangles.indices,
      })
      const mesh = new Mesh({ geometry, texture: Texture.WHITE, tint: EDGE_COLOR })
      this.edgeMesh = mesh
      this.root.addChild(mesh)
    } else {
      const nodes: Graphics[] = []
      for (let index = 0; index < nodeIds.length; index++) {
        const g = new Graphics()
        g.circle(0, 0, NODE_RADIUS).fill({ color: NODE_COLOR })
        g.position.set(positions[index * 2], positions[index * 2 + 1])
        nodes.push(g)
      }
      this.nodeViews = nodes
      this.root.addChild(...nodes)
      const edges2 = new Graphics()
      for (const [a, b] of edges) {
        edges2.moveTo(positions[a * 2], positions[a * 2 + 1])
        edges2.lineTo(positions[b * 2], positions[b * 2 + 1])
      }
      edges2.stroke({ width: EDGE_THICKNESS, color: EDGE_COLOR })
      this.root.addChild(edges2)
    }
    this.app.stage.addChild(this.root)
  }

  fitCamera(): void {
    Object.assign(this.camera, fitCamera(this.geometry.positions, { width: this.viewWidth, height: this.viewHeight }))
    this.applyCamera()
  }

  applyCamera(): void {
    this.root.scale.set(this.camera.scale)
    this.root.position.set(this.camera.tx, this.camera.ty)
  }

  panBy(dx: number, dy: number): void {
    Object.assign(this.camera, panCamera(this.camera, dx, dy))
    this.applyCamera()
  }

  zoomBy(factor: number, anchorX = this.viewWidth / 2, anchorY = this.viewHeight / 2): void {
    Object.assign(this.camera, zoomCamera(this.camera, factor, anchorX, anchorY))
    this.applyCamera()
  }

  resetCamera(): void {
    this.fitCamera()
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return screenToWorld(this.camera, screenX, screenY)
  }

  private worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return worldToScreen(this.camera, worldX, worldY)
  }

  visibleNodeCount(): number {
    let count = 0
    const { positions } = this.geometry
    for (let index = 0; index < this.geometry.nodeIds.length; index++) {
      const p = this.worldToScreen(positions[index * 2], positions[index * 2 + 1])
      if (p.x >= 0 && p.x <= this.viewWidth && p.y >= 0 && p.y <= this.viewHeight) count += 1
    }
    return count
  }

  visibleEdgeCount(): number {
    let count = 0
    const { positions, edges } = this.geometry
    const inView = (x: number, y: number): boolean => {
      const p = this.worldToScreen(x, y)
      return p.x >= 0 && p.x <= this.viewWidth && p.y >= 0 && p.y <= this.viewHeight
    }
    for (const [a, b] of edges) {
      if (inView(positions[a * 2], positions[a * 2 + 1]) || inView(positions[b * 2], positions[b * 2 + 1])) count += 1
    }
    return count
  }

  currentNodeCount(): number {
    return this.geometry.nodeIds.length
  }

  currentEdgeCount(): number {
    return this.geometry.edges.length
  }

  pickNodeAt(screenX: number, screenY: number): number | null {
    const world = this.screenToWorld(screenX, screenY)
    const { positions } = this.geometry
    let best = -1
    let bestDist = Infinity
    for (let index = 0; index < this.geometry.nodeIds.length; index++) {
      const dx = positions[index * 2] - world.x
      const dy = positions[index * 2 + 1] - world.y
      const dist = Math.hypot(dx, dy)
      if (dist <= NODE_RADIUS && dist < bestDist) {
        bestDist = dist
        best = index
      }
    }
    return best === -1 ? null : best
  }

  setNodeColor(count: number, color: number): void {
    const limit = Math.min(count, this.nodeViews.length)
    for (let index = 0; index < limit; index++) {
      const view = this.nodeViews[index]
      if (view instanceof Graphics) {
        view.clear()
        view.circle(0, 0, NODE_RADIUS).fill({ color })
      } else {
        view.tint = color
      }
    }
  }

  updatePositions(count: number, dx: number, dy: number): void {
    const limit = Math.min(count, this.geometry.nodeIds.length)
    const { positions } = this.geometry
    for (let index = 0; index < limit; index++) {
      positions[index * 2] += dx
      positions[index * 2 + 1] += dy
    }
    for (let index = 0; index < limit; index++) {
      const view = this.nodeViews[index]
      view.x = positions[index * 2]
      view.y = positions[index * 2 + 1]
    }
    this.rebuildEdges()
  }

  private rebuildEdges(): void {
    if (this.representation === "particles" && this.edgeMesh) {
      const triangles = edgeTriangles(this.geometry.positions, this.geometry.edges, EDGE_THICKNESS)
      this.edgeMesh.geometry.positions = triangles.positions
      this.edgeMesh.geometry.uvs = triangles.uvs
      this.edgeMesh.geometry.indices = triangles.indices
    } else if (this.representation === "retained") {
      this.root.removeChildren()
      this.root.addChild(...(this.nodeViews as ContainerChild[]))
      const edges2 = new Graphics()
      const { positions, edges } = this.geometry
      for (const [a, b] of edges) {
        edges2.moveTo(positions[a * 2], positions[a * 2 + 1])
        edges2.lineTo(positions[b * 2], positions[b * 2 + 1])
      }
      edges2.stroke({ width: EDGE_THICKNESS, color: EDGE_COLOR })
      this.root.addChild(edges2)
    }
  }

  resize(width: number, height: number): void {
    this.opts.width = width
    this.opts.height = height
    this.app.renderer.resize(width, height)
    this.fitCamera()
  }

  replace(geometry: Geometry): void {
    this.geometry.nodeIds.length = 0
    this.geometry.nodeIds.push(...geometry.nodeIds)
    this.geometry.positions = geometry.positions
    this.geometry.edges.length = 0
    this.geometry.edges.push(...geometry.edges)
    this.buildScene()
    this.fitCamera()
  }

  dispose(): void {
    this.app.destroy(true, { children: true })
  }
}
