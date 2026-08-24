import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from "three"
import type { WebGPURenderer } from "three/webgpu"
import type { Geometry, PixelReadback } from "@hafley66/grapht"
import { edgeTriangles, fitCamera, panCamera, screenToWorld, worldToScreen, zoomCamera, type CameraState } from "./7_geometryMath.js"

export const NODE_RADIUS = 4
export const EDGE_THICKNESS = 1.5
export const NODE_COLOR = 0x4a7fdf
export const EDGE_COLOR = 0x2a3a55

export const NODE_SEGMENTS = 16
const CAMERA_Z = 10
const CAMERA_NEAR = 0.1
const CAMERA_FAR = 1000

export type RendererMode = "webgl" | "webgpu"
export type Representation = "retained" | "particles"
export type ActualBackend = RendererMode

export { type CameraState }

export type ThreeRenderer = WebGLRenderer | WebGPURenderer

export type ThreeProjectionOptions = {
  renderer: RendererMode
  representation: Representation
  width?: number
  height?: number
  devicePixelRatio?: number
  backgroundColor?: number
}

export type ThreeProjectionInfo = {
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

export type { PixelReadback }

function edgeBufferGeometry(positions: Float32Array, edges: [number, number][]): BufferGeometry {
  const triangles = edgeTriangles(positions, edges, EDGE_THICKNESS)
  const geometry = new BufferGeometry()
  writeEdgeAttributes(geometry, triangles)
  return geometry
}

function writeEdgeAttributes(geometry: BufferGeometry, triangles: { positions: Float32Array; indices: Uint32Array }): void {
  const vertexCount = triangles.positions.length / 2
  const flat = new Float32Array(vertexCount * 3)
  for (let index = 0; index < vertexCount; index++) {
    flat[index * 3] = triangles.positions[index * 2]
    flat[index * 3 + 1] = triangles.positions[index * 2 + 1]
    flat[index * 3 + 2] = 0
  }
  geometry.setAttribute("position", new BufferAttribute(flat, 3))
  geometry.setIndex(new BufferAttribute(triangles.indices, 1))
  geometry.getAttribute("position").needsUpdate = true
}

export class ThreeProjection {
  readonly scene = new Scene()
  readonly view: OrthographicCamera
  readonly container: HTMLElement
  readonly camera: CameraState = { scale: 1, tx: 0, ty: 0 }

  readonly geometry: Geometry
  readonly representation: Representation
  readonly requestedRenderer: RendererMode

  readonly root = new Group()

  nodeViews: Mesh[] = []
  private instancedNodes: InstancedMesh | null = null
  private nodeGeometry: CircleGeometry | null = null
  private edgeMesh: Mesh | null = null
  private rendererValue: ThreeRenderer | null = null
  private webgpuFallbackReason: string | null = null

  private readonly opts: Required<ThreeProjectionOptions>
  private readonly scratchColor = new Color()
  private readonly scratchMatrix = new Matrix4()

  constructor(container: HTMLElement, geometry: Geometry, options: ThreeProjectionOptions) {
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
    this.scene.background = new Color(this.opts.backgroundColor)
    this.view = new OrthographicCamera(
      -this.opts.width / 2,
      this.opts.width / 2,
      -this.opts.height / 2,
      this.opts.height / 2,
      CAMERA_NEAR,
      CAMERA_FAR,
    )
    this.view.position.z = CAMERA_Z
  }

  get renderer(): ThreeRenderer {
    if (!this.rendererValue) throw new Error("ThreeProjection.init() has not completed")
    return this.rendererValue
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
    const renderer = this.rendererValue
    if (!renderer || renderer instanceof WebGLRenderer) return "webgl"
    const backend = (renderer as WebGPURenderer).backend as { isWebGPUBackend?: boolean } | undefined
    return backend?.isWebGPUBackend === true ? "webgpu" : "webgl"
  }

  async init(): Promise<void> {
    this.rendererValue = await this.createRenderer()
    this.renderer.setPixelRatio(this.devicePixelRatio)
    this.renderer.setSize(this.viewWidth, this.viewHeight)
    this.container.appendChild(this.renderer.domElement)
    this.buildScene()
    this.fitCamera()
  }

  private async createRenderer(): Promise<ThreeRenderer> {
    if (this.requestedRenderer === "webgpu") {
      try {
        const { WebGPURenderer: WebGPURendererClass } = await import("three/webgpu")
        const renderer = new WebGPURendererClass({ antialias: false, alpha: false })
        await renderer.init()
        return renderer
      } catch (error) {
        this.webgpuFallbackReason = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      }
    }
    return new WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: true })
  }

  get fallbackReason(): string | null {
    return this.webgpuFallbackReason
  }

  info(): ThreeProjectionInfo {
    let webgpuAdapter: string | null = null
    let webgpuDevice: string | null = null
    if (this.actualBackend === "webgpu") {
      const backend = (this.renderer as WebGPURenderer).backend as {
        adapter?: { info?: { vendor: string; architecture: string; device: string } }
        device?: unknown
      }
      const adapterInfo = backend.adapter?.info
      webgpuAdapter = adapterInfo ? `${adapterInfo.vendor} / ${adapterInfo.architecture} / ${adapterInfo.device}` : "unknown"
      webgpuDevice = backend.device ? "present" : "absent"
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
    this.renderer.render(this.scene, this.view)
  }

  async firstRender(): Promise<void> {
    this.render()
    await this.settleFrames(4)
  }

  private buildScene(): void {
    this.clearScene()
    const { nodeIds, positions, edges } = this.geometry
    this.nodeGeometry = new CircleGeometry(NODE_RADIUS, NODE_SEGMENTS)
    if (this.representation === "particles") {
      const material = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide })
      const instanced = new InstancedMesh(this.nodeGeometry, material, Math.max(1, nodeIds.length))
      instanced.count = nodeIds.length
      this.scratchColor.setHex(NODE_COLOR)
      for (let index = 0; index < nodeIds.length; index++) {
        this.scratchMatrix.makeTranslation(positions[index * 2], positions[index * 2 + 1], 0)
        instanced.setMatrixAt(index, this.scratchMatrix)
        instanced.setColorAt(index, this.scratchColor)
      }
      instanced.instanceMatrix.needsUpdate = true
      if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true
      instanced.frustumCulled = false
      this.instancedNodes = instanced
      this.nodeViews = []
      this.root.add(instanced)
    } else {
      const nodes: Mesh[] = []
      for (let index = 0; index < nodeIds.length; index++) {
        const mesh = new Mesh(this.nodeGeometry, new MeshBasicMaterial({ color: NODE_COLOR, side: DoubleSide }))
        mesh.position.set(positions[index * 2], positions[index * 2 + 1], 0)
        nodes.push(mesh)
        this.root.add(mesh)
      }
      this.nodeViews = nodes
      this.instancedNodes = null
    }

    const edgeGeometry = edgeBufferGeometry(positions, edges)
    const edgeMesh = new Mesh(edgeGeometry, new MeshBasicMaterial({ color: EDGE_COLOR, side: DoubleSide }))
    edgeMesh.frustumCulled = false
    this.edgeMesh = edgeMesh
    this.root.add(edgeMesh)
    this.scene.add(this.root)
  }

  private clearScene(): void {
    for (const child of [...this.root.children]) this.root.remove(child)
    for (const mesh of this.nodeViews) disposeMaterial(mesh)
    if (this.instancedNodes) {
      disposeMaterial(this.instancedNodes)
      this.instancedNodes.dispose()
    }
    if (this.edgeMesh) {
      disposeMaterial(this.edgeMesh)
      this.edgeMesh.geometry.dispose()
    }
    this.nodeGeometry?.dispose()
    this.nodeViews = []
    this.instancedNodes = null
    this.edgeMesh = null
    this.nodeGeometry = null
  }

  fitCamera(): void {
    Object.assign(this.camera, fitCamera(this.geometry.positions, { width: this.viewWidth, height: this.viewHeight }))
    this.applyCamera()
  }

  applyCamera(): void {
    const { scale, tx, ty } = this.camera
    this.view.zoom = scale
    this.view.position.set((this.viewWidth / 2 - tx) / scale, (this.viewHeight / 2 - ty) / scale, CAMERA_Z)
    this.view.updateProjectionMatrix()
    this.view.updateMatrixWorld()
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
    this.scratchColor.setHex(color)
    if (this.instancedNodes) {
      const limit = Math.min(count, this.instancedNodes.count)
      for (let index = 0; index < limit; index++) this.instancedNodes.setColorAt(index, this.scratchColor)
      if (this.instancedNodes.instanceColor) this.instancedNodes.instanceColor.needsUpdate = true
      return
    }
    const limit = Math.min(count, this.nodeViews.length)
    for (let index = 0; index < limit; index++) {
      const material = this.nodeViews[index].material as MeshBasicMaterial
      material.color.setHex(color)
    }
  }

  updatePositions(count: number, dx: number, dy: number): void {
    const limit = Math.min(count, this.geometry.nodeIds.length)
    const { positions } = this.geometry
    for (let index = 0; index < limit; index++) {
      positions[index * 2] += dx
      positions[index * 2 + 1] += dy
    }
    if (this.instancedNodes) {
      for (let index = 0; index < limit; index++) {
        this.scratchMatrix.makeTranslation(positions[index * 2], positions[index * 2 + 1], 0)
        this.instancedNodes.setMatrixAt(index, this.scratchMatrix)
      }
      this.instancedNodes.instanceMatrix.needsUpdate = true
    } else {
      for (let index = 0; index < limit; index++) {
        this.nodeViews[index].position.set(positions[index * 2], positions[index * 2 + 1], 0)
      }
    }
    this.rebuildEdges()
  }

  private rebuildEdges(): void {
    if (!this.edgeMesh) return
    const triangles = edgeTriangles(this.geometry.positions, this.geometry.edges, EDGE_THICKNESS)
    writeEdgeAttributes(this.edgeMesh.geometry, triangles)
  }

  setDevicePixelRatio(ratio: number): void {
    this.opts.devicePixelRatio = ratio
    this.renderer.setPixelRatio(ratio)
    this.renderer.setSize(this.viewWidth, this.viewHeight)
    this.applyCamera()
  }

  resize(width: number, height: number): void {
    this.opts.width = width
    this.opts.height = height
    this.view.left = -width / 2
    this.view.right = width / 2
    this.view.top = -height / 2
    this.view.bottom = height / 2
    this.renderer.setSize(width, height)
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

  readViewportPixels(): PixelReadback {
    const canvas = this.renderer.domElement
    const width = canvas.width
    const height = canvas.height
    const surface = document.createElement("canvas")
    surface.width = width
    surface.height = height
    const context = surface.getContext("2d")
    if (!context) throw new Error("2d readback context unavailable")
    context.drawImage(canvas, 0, 0)
    const image = context.getImageData(0, 0, width, height)
    return { pixels: image.data, width, height }
  }

  dispose(): void {
    this.clearScene()
    this.scene.remove(this.root)
    const canvas = this.rendererValue?.domElement
    this.rendererValue?.dispose()
    if (canvas?.parentElement) canvas.parentElement.removeChild(canvas)
    this.rendererValue = null
  }
}

function disposeMaterial(mesh: Mesh | InstancedMesh): void {
  const material = mesh.material
  if (Array.isArray(material)) {
    for (const item of material) item.dispose()
  } else {
    material.dispose()
  }
}
