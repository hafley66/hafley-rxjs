import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene as World,
  WebGLRenderer,
} from "three"
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js"
import type { Frame, Id, Item, Renderer } from "./0_types"
import { indexOf } from "./2_geometry"
import { renderer } from "./4_renderer"

const NODE_RADIUS = 4
const EDGE_THICKNESS = 1.5
const NODE_COLOR = 0x4a7fdf
const EDGE_COLOR = 0x2a3a55
const NODE_SEGMENTS = 16

export type ThreeSceneOptions = {
  width?: number
  height?: number
  background?: number
  maxFPS?: number
  /** Items of this `kind` render as `CSS2DObject`; `attrs.element` or `attrs.html` supplies the markup. */
  cardKind?: string
  nodeColor?: number
  edgeColor?: number
}

type View = Mesh | CSS2DObject

type State = {
  gl: WebGLRenderer | null
  css: CSS2DRenderer
  ready: boolean
  camera: OrthographicCamera
  world: World
  overlay: World
  edges: LineSegments<BufferGeometry, LineBasicMaterial>
  edgePos: Float32Array
  views: Map<Id, View>
  slots: View[]
  slotIds: readonly Id[] | null
  pool: Mesh[]
  nodeGeometry: CircleGeometry
  nodeMaterial: MeshBasicMaterial
  pending: number
  lastPresent: number
  options: Required<ThreeSceneOptions>
}

const DEFAULTS: Required<ThreeSceneOptions> = {
  width: 800,
  height: 600,
  background: 0x111111,
  maxFPS: 60,
  cardKind: "card",
  nodeColor: NODE_COLOR,
  edgeColor: EDGE_COLOR,
}

/** One circle for every node view. `DoubleSide` because the y-down frustum reverses triangle winding. */
function circleMaterial(color: number): MeshBasicMaterial {
  return new MeshBasicMaterial({ color, side: DoubleSide })
}

/** `left, right, top, bottom` = `0, width, 0, height` puts pixel `(x, y)` of a `Geometry.pos` pair on screen pixel `(x, y)`, y growing downward, the same mapping the pixi sink uses. */
function pixelCamera(width: number, height: number): OrthographicCamera {
  const camera = new OrthographicCamera(0, width, 0, height, 0.1, 100)
  camera.position.z = 10
  camera.updateMatrixWorld()
  return camera
}

/** `null` when the document has no WebGL2, which is how jsdom runs. The scene graph still tracks views so the sink stays testable without a GPU. */
function createRenderer(width: number, height: number): WebGLRenderer | null {
  if (typeof WebGL2RenderingContext === "undefined") return null
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("webgl2")
  if (!context) return null
  const gl = new WebGLRenderer({ canvas, context, antialias: false })
  // Pixel ratio 1 keeps the canvas backing store on the CSS pixel grid, so the CSS2D layer needs no counter-scale at any device pixel ratio.
  gl.setPixelRatio(1)
  gl.setSize(width, height)
  return gl
}

function cardElement(item: Item): HTMLElement {
  const given = item.attrs?.element
  if (given instanceof HTMLElement) return given
  const el = document.createElement("div")
  el.className = "scene-card"
  el.dataset.id = item.id
  el.innerHTML = String(item.attrs?.html ?? item.id)
  return el
}

function subscribe(host: HTMLElement, options: Required<ThreeSceneOptions>): State {
  const world = new World()
  world.background = new Color(options.background)
  const overlay = new World()
  const edgePos = new Float32Array(0)
  const edgeGeometry = new BufferGeometry()
  const attribute = new BufferAttribute(edgePos, 3)
  attribute.setUsage(DynamicDrawUsage)
  edgeGeometry.setAttribute("position", attribute)
  edgeGeometry.setDrawRange(0, 0)
  const edges = new LineSegments(
    edgeGeometry,
    new LineBasicMaterial({ color: options.edgeColor, linewidth: EDGE_THICKNESS }),
  )
  edges.frustumCulled = false
  world.add(edges)
  const gl = createRenderer(options.width, options.height)
  if (gl) host.appendChild(gl.domElement)
  const css = new CSS2DRenderer()
  css.domElement.style.cssText = "position:absolute;left:0;top:0;overflow:hidden;pointer-events:none"
  css.setSize(options.width, options.height)
  host.appendChild(css.domElement)
  const state: State = {
    gl,
    css,
    ready: true,
    camera: pixelCamera(options.width, options.height),
    world,
    overlay,
    edges,
    edgePos,
    views: new Map(),
    slots: [],
    slotIds: null,
    pool: [],
    nodeGeometry: new CircleGeometry(NODE_RADIUS, NODE_SEGMENTS),
    nodeMaterial: circleMaterial(options.nodeColor),
    pending: 0,
    lastPresent: Number.NEGATIVE_INFINITY,
    options,
  }
  ;(host as HTMLElement & { __threeScene?: State }).__threeScene = state
  return state
}

function enter(state: State, item: Item): View {
  if (item.kind === state.options.cardKind) {
    const view = new CSS2DObject(cardElement(item))
    // Anchor the element by its top-left corner, matching how a pixi `DOMContainer` sits at its position.
    view.center.set(0, 0)
    view.name = item.id
    state.overlay.add(view)
    return view
  }
  const view = state.pool.pop() ?? new Mesh(state.nodeGeometry, state.nodeMaterial)
  view.name = item.id
  view.visible = true
  view.frustumCulled = false
  state.world.add(view)
  return view
}

function exit(state: State, view: View): void {
  if (view instanceof CSS2DObject) {
    state.overlay.remove(view)
    view.element.remove()
    return
  }
  state.world.remove(view)
  view.visible = false
  state.pool.push(view)
}

/** Grow the shared line buffer to hold `count` segments. The array is reused across frames; only a capacity change reallocates. */
function edgeBuffer(state: State, count: number): Float32Array {
  if (state.edgePos.length >= count * 6) return state.edgePos
  const grown = new Float32Array(count * 6)
  const attribute = new BufferAttribute(grown, 3)
  attribute.setUsage(DynamicDrawUsage)
  state.edges.geometry.setAttribute("position", attribute)
  state.edgePos = grown
  return grown
}

/** Views are slot-aligned to `ids` and rebuilt only when the `ids` array changes or something exits, so a steady scene pays one write per point per frame. */
function draw(state: State, frame: Frame): void {
  const { scene, geometry, diff } = frame
  for (const id of diff.exit) {
    const view = state.views.get(id)
    if (view) {
      exit(state, view)
      state.views.delete(id)
    }
  }
  const ids = geometry.ids
  const pos = geometry.pos
  if (state.slotIds !== ids || diff.exit.length) {
    state.slots.length = ids.length
    for (let i = 0; i < ids.length; i++) {
      let view = state.views.get(ids[i])
      if (!view) {
        const item = scene.items.get(ids[i])
        if (!item) continue
        view = enter(state, item)
        state.views.set(ids[i], view)
      }
      state.slots[i] = view
    }
    state.slotIds = ids
  }
  const slots = state.slots
  for (let i = 0; i < slots.length; i++) {
    const view = slots[i]
    if (view) view.position.set(pos[2 * i], pos[2 * i + 1], 0)
  }
  const index = indexOf(geometry)
  const line = edgeBuffer(state, scene.edges.size)
  let n = 0
  for (const [a, b] of scene.edges.values()) {
    const i = index.get(a)
    const j = index.get(b)
    if (i === undefined || j === undefined) continue
    line[6 * n] = pos[2 * i]
    line[6 * n + 1] = pos[2 * i + 1]
    line[6 * n + 2] = 0
    line[6 * n + 3] = pos[2 * j]
    line[6 * n + 4] = pos[2 * j + 1]
    line[6 * n + 5] = 0
    n++
  }
  state.edges.geometry.getAttribute("position").needsUpdate = true
  state.edges.geometry.setDrawRange(0, n * 2)
  state.edges.visible = n > 0
}

function flush(state: State): void {
  state.pending = 0
  state.lastPresent = performance.now()
  state.gl?.render(state.world, state.camera)
  state.css.render(state.overlay, state.camera)
}

/** `maxFPS` caps how often the two layers repaint. A capped frame schedules a trailing repaint so the last geometry written always reaches the screen. */
function present(state: State): void {
  if (performance.now() - state.lastPresent >= 1000 / state.options.maxFPS) {
    flush(state)
    return
  }
  if (state.pending === 0) state.pending = requestAnimationFrame(() => flush(state))
}

function next(state: State, frame: Frame): void {
  draw(state, frame)
  present(state)
}

function unsubscribe(state: State): void {
  state.ready = false
  if (state.pending !== 0) cancelAnimationFrame(state.pending)
  state.pending = 0
  for (const view of state.views.values()) {
    if (view instanceof CSS2DObject) view.element.remove()
    view.removeFromParent()
  }
  state.views.clear()
  for (const mesh of state.pool) mesh.removeFromParent()
  state.pool.length = 0
  state.slots.length = 0
  state.slotIds = null
  state.nodeGeometry.dispose()
  state.nodeMaterial.dispose()
  state.edges.geometry.dispose()
  state.edges.material.dispose()
  state.css.domElement.remove()
  state.gl?.domElement.remove()
  state.gl?.dispose()
}

/** Three.js renderer as an rxjs operator: `frame$.pipe(three()(host)).subscribe()`. One `Mesh` per node over a shared circle geometry, one `LineSegments` for every edge, `CSS2DObject` for cards. */
export function three(options: ThreeSceneOptions = {}): Renderer {
  const resolved = { ...DEFAULTS, ...options }
  return renderer<State>({ subscribe: host => subscribe(host, resolved), next, unsubscribe })
}

/** Test seam: live views by id, pooled mesh count, and whether the sink is mounted. */
export function inspect(host: HTMLElement): { ids: string[]; pooled: number; ready: boolean } | null {
  const state = (host as HTMLElement & { __threeScene?: State }).__threeScene
  if (!state) return null
  return { ids: [...state.views.keys()], pooled: state.pool.length, ready: state.ready }
}
