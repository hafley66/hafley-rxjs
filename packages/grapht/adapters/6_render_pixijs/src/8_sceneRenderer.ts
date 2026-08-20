import { type Frame, type Id, type Item, indexOf, type Renderer, renderer } from "@hafley66/scene"
import { Application, Container, DOMContainer, Graphics, Sprite, type Texture } from "pixi.js"
import { EDGE_COLOR, EDGE_THICKNESS, NODE_COLOR, NODE_RADIUS } from "./2_projection.js"

export type PixiSceneOptions = {
  width?: number
  height?: number
  background?: number
  maxFPS?: number
  /** Items of this `kind` render as `DOMContainer`; `attrs.element` or `attrs.html` supplies the markup. */
  cardKind?: string
  nodeColor?: number
  edgeColor?: number
}

type View = Sprite | DOMContainer

type State = {
  app: Application
  ready: Promise<void>
  live: boolean
  world: Container
  edges: Graphics
  views: Map<Id, View>
  slots: View[]
  slotIds: readonly Id[] | null
  pool: Sprite[]
  nodeTexture: Texture | null
  latest: Frame | null
  options: Required<PixiSceneOptions>
}

const DEFAULTS: Required<PixiSceneOptions> = {
  width: 800,
  height: 600,
  background: 0x111111,
  maxFPS: 60,
  cardKind: "card",
  nodeColor: NODE_COLOR,
  edgeColor: EDGE_COLOR,
}

function circleTexture(app: Application, color: number): Texture {
  const g = new Graphics().circle(0, 0, NODE_RADIUS).fill({ color })
  const texture = app.renderer.generateTexture({ target: g, resolution: 1 })
  g.destroy()
  return texture
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

function subscribe(host: HTMLElement, options: Required<PixiSceneOptions>): State {
  const app = new Application()
  const world = new Container()
  const edges = new Graphics()
  world.addChild(edges)
  const state: State = {
    app,
    ready: Promise.resolve(),
    live: true,
    world,
    edges,
    views: new Map(),
    slots: [],
    slotIds: null,
    pool: [],
    nodeTexture: null,
    latest: null,
    options,
  }
  ;(host as HTMLElement & { __pixiScene?: State }).__pixiScene = state
  state.ready = app
    .init({
      width: options.width,
      height: options.height,
      background: options.background,
      resolution: 1,
      autoDensity: true,
      antialias: false,
    })
    .then(() => {
      if (!state.live) return
      app.ticker.maxFPS = options.maxFPS
      host.appendChild(app.canvas)
      app.stage.addChild(world)
      state.nodeTexture = circleTexture(app, options.nodeColor)
      if (state.latest) draw(state, state.latest)
    })
  return state
}

function enter(state: State, item: Item): View {
  if (item.kind === state.options.cardKind) {
    const view = new DOMContainer({ element: cardElement(item) })
    view.label = item.id
    state.world.addChild(view)
    return view
  }
  const view = state.pool.pop() ?? new Sprite({ texture: state.nodeTexture ?? undefined, anchor: 0.5 })
  view.label = item.id
  view.visible = true
  state.world.addChild(view)
  return view
}

function exit(state: State, view: View): void {
  state.world.removeChild(view)
  if (view instanceof Sprite) {
    view.visible = false
    state.pool.push(view)
  } else {
    view.destroy()
  }
}

/** Enter is derived from the geometry, not `diff.enter`, so frames collapsed while `init` was pending still mount every id. Views are slot-aligned to `ids` and rebuilt only when the `ids` array changes or something exits. */
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
    if (view) view.position.set(pos[2 * i], pos[2 * i + 1])
  }
  const index = indexOf(geometry)
  const g = state.edges.clear()
  for (const [a, b] of scene.edges.values()) {
    const i = index.get(a)
    const j = index.get(b)
    if (i === undefined || j === undefined) continue
    g.moveTo(pos[2 * i], pos[2 * i + 1]).lineTo(pos[2 * j], pos[2 * j + 1])
  }
  g.stroke({ color: state.options.edgeColor, width: EDGE_THICKNESS })
}

function next(state: State, frame: Frame): void {
  state.latest = frame
  if (state.nodeTexture) draw(state, frame)
}

function unsubscribe(state: State): void {
  state.live = false
  state.latest = null
  void state.ready.then(() => {
    for (const view of state.views.values()) {
      if (view instanceof DOMContainer) view.element?.remove()
      view.destroy()
    }
    for (const sprite of state.pool) sprite.destroy()
    state.nodeTexture?.destroy(true)
    state.app.destroy(true, { children: true })
  })
}

/** Pixi renderer as an rxjs operator: `frame$.pipe(pixi()(host)).subscribe()`. Frames before `Application.init` resolves are held and drawn once. */
export function pixi(options: PixiSceneOptions = {}): Renderer {
  const resolved = { ...DEFAULTS, ...options }
  return renderer<State>({ subscribe: host => subscribe(host, resolved), next, unsubscribe })
}

/** Test seam: live views by id, pooled sprite count, and whether the app has initialised. */
export function inspect(host: HTMLElement): { ids: string[]; pooled: number; ready: boolean } | null {
  const state = (host as HTMLElement & { __pixiScene?: State }).__pixiScene
  if (!state) return null
  return { ids: [...state.views.keys()], pooled: state.pool.length, ready: state.nodeTexture !== null }
}
