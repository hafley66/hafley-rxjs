import { Application, Assets, Container, Graphics, Sprite, Text, Texture, type FederatedPointerEvent } from "pixi.js"
import { SVGScene } from "@pixi-essentials/svg"
import { graphLayoutScopeOf } from "@hafley66/grapht-model"
import { connect, defer, finalize, from, ReplaySubject, switchMap, tap } from "rxjs"
import type {
  GraphFrame,
  GraphRenderReceipt,
  GraphRenderer,
  RendererInteractions,
  SealedSvgArtifact,
} from "@hafley66/grapht/browser"
import { graphRenderReceipt, sealedGeometryTransformOf } from "@hafley66/grapht/browser"
import { replaceSvgTextNodes, svgRootForPixi } from "./7a_svgText.js"

export type PixiSealedSvgResource = {
  texture: Texture
  unsubscribe(): void | Promise<void>
}

export type PixiSealedSvgLoader = (artifact: SealedSvgArtifact) => Promise<PixiSealedSvgResource>

export type PixiGraphRendererOptions = {
  backgroundColor?: number
  antialias?: boolean
  interactions?: RendererInteractions
  sealedSvgLoader?: PixiSealedSvgLoader
}

async function loadSealedSvgTexture(artifact: SealedSvgArtifact): Promise<PixiSealedSvgResource> {
  const alias = `grapht-sealed-svg:${artifact.rootId}:${artifact.revisionId}`
  const texture = await Assets.load<Texture>({
    alias,
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(artifact.svg)}`,
  })
  let unsubscribed = false
  return {
    texture,
    async unsubscribe() {
      if (unsubscribed) return
      unsubscribed = true
      await Assets.unload(alias)
    },
  }
}

function labelPosition(frame: GraphFrame, id: string): { x: number; y: number } {
  const item = frame.graph[id]
  const bounds = frame.geometry.boundsById[id]
  const anchor = frame.geometry.endpointAnchorById[id]
  if (item?.type === "node" && bounds) {
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  }
  if (item?.type === "edge") {
    const route = frame.geometry.routesById[id]
    if (route && route.length >= 4) {
      return { x: (route[0] + route[route.length - 2]) / 2, y: (route[1] + route[route.length - 1]) / 2 }
    }
    const from = frame.geometry.endpointAnchorById[item.fromId]
    const to = frame.geometry.endpointAnchorById[item.toId]
    const x = from?.x ?? anchor?.x ?? 0
    const y = from?.y ?? anchor?.y ?? 0
    return { x: x + ((to?.x ?? x) - x) / 2, y: y + ((to?.y ?? y) - y) / 2 }
  }
  return anchor ?? { x: 0, y: 0 }
}

export class PixiGraphFrameResource {
  readonly app = new Application()
  readonly root = new Container()
  readonly labelOverlay = new Container()
  readonly overlay = new Container()
  readonly edges = new Map<string, Graphics>()
  readonly nodes = new Map<string, Graphics>()
  readonly headers = new Map<string, Graphics>()
  readonly labels = new Map<string, Text>()
  readonly headerLabels = new Map<string, Text>()
  readonly sealedSvgSprites = new Map<string, { revisionId: string; sprite: Sprite; resource: PixiSealedSvgResource }>()
  readonly sealedSvgScenes = new Map<string, { revisionId: string; scene: SVGScene; interactiveBindingCount: number; displaysByGraphId: ReadonlyMap<string, readonly { display: Container; x: number; y: number }[]> }>()
  readonly sealedSvgLoadRevisionByRootId = new Map<string, string>()
  readonly sealedSvgPlacementsByRootId = new Map<string, { artifact: SealedSvgArtifact; bounds: { x: number; y: number; width: number; height: number } }>()
  readonly movableDisplays = new Map<string, Container>()
  readonly eventUnsubscribes: Array<() => void> = []
  initialized = false
  unsubscribed = false
  labelGeometryRevisionId: string | undefined
  camera: GraphFrame["camera"] = {
    x: 0,
    y: 0,
    scale: 1,
    viewport: { x: 0, y: 0, width: 0, height: 0 },
  }

  constructor(
    readonly host: HTMLElement,
    readonly options: PixiGraphRendererOptions,
  ) {}

  async init(): Promise<this> {
    await this.app.init({
      resizeTo: this.host,
      background: this.options.backgroundColor ?? 0x10141c,
      antialias: this.options.antialias ?? true,
    })
    this.initialized = true
    if (this.unsubscribed) {
      this.app.destroy(true, { children: true })
      return this
    }
    this.host.appendChild(this.app.canvas)
    this.app.stage.addChild(this.root)
    this.app.stage.addChild(this.labelOverlay)
    this.app.stage.addChild(this.overlay)
    this.app.ticker.stop()
    this.bindCameraInteractions()
    return this
  }

  bindCameraInteractions(): void {
    const interactions = this.options.interactions
    if (!interactions) return
    let pointerId: number | undefined
    let previousX = 0
    let previousY = 0
    const emit = (camera: GraphFrame["camera"]): void => {
      this.camera = camera
      interactions.cameraInput$.next(camera)
    }
    const pointerdown = (event: PointerEvent): void => {
      pointerId = event.pointerId
      previousX = event.clientX
      previousY = event.clientY
      this.host.setPointerCapture?.(event.pointerId)
    }
    const pointermove = (event: PointerEvent): void => {
      if (pointerId !== event.pointerId) return
      const dx = event.clientX - previousX
      const dy = event.clientY - previousY
      previousX = event.clientX
      previousY = event.clientY
      emit({ ...this.camera, x: this.camera.x + dx, y: this.camera.y + dy })
    }
    const pointerup = (event: PointerEvent): void => {
      if (pointerId !== event.pointerId) return
      this.host.releasePointerCapture?.(event.pointerId)
      pointerId = undefined
    }
    const wheel = (event: WheelEvent): void => {
      event.preventDefault()
      if (event.ctrlKey) {
        const scale = Math.min(8, Math.max(0.1, this.camera.scale * Math.exp(-event.deltaY * 0.002)))
        emit({ ...this.camera, scale })
      } else if (event.metaKey) {
        emit({ ...this.camera, x: this.camera.x - (event.deltaX || event.deltaY) })
      } else {
        emit({ ...this.camera, y: this.camera.y - event.deltaY })
      }
    }
    const bindings = [
      ["pointerdown", pointerdown],
      ["pointermove", pointermove],
      ["pointerup", pointerup],
      ["pointercancel", pointerup],
      ["wheel", wheel],
    ] as const
    for (const [type, listener] of bindings) {
      this.host.addEventListener(type, listener as EventListener, { passive: false })
      this.eventUnsubscribes.push(() => this.host.removeEventListener(type, listener as EventListener))
    }
  }

  render(frame: GraphFrame, receipt: GraphRenderReceipt): void {
    const previousCamera = this.camera
    this.camera = frame.camera
    const zoomChanged = previousCamera.scale !== frame.camera.scale
    if (previousCamera.x !== frame.camera.x || previousCamera.y !== frame.camera.y) {
      this.labelOverlay.position.set(frame.camera.x, frame.camera.y)
    }
    const layoutIds = new Set(graphLayoutScopeOf(frame.graph).itemIds)
    const renderIds = new Set([...layoutIds, ...Object.keys(frame.geometry.routesById)])
    for (const [id, edge] of this.edges) {
      if (renderIds.has(id)) continue
      edge.destroy()
      this.edges.delete(id)
    }
    for (const [id, node] of this.nodes) {
      if (layoutIds.has(id)) continue
      node.destroy()
      this.nodes.delete(id)
    }
    for (const id of receipt.exitIds) {
      this.edges.get(id)?.destroy()
      this.nodes.get(id)?.destroy()
      this.labels.get(id)?.destroy()
      this.edges.delete(id)
      this.nodes.delete(id)
      this.labels.delete(id)
    }

    for (const id of [...receipt.enterIds, ...receipt.updateIds]) {
      if (!renderIds.has(id)) continue
      const item = frame.graph[id]
      if (item === undefined) continue
      if (item.type === "edge") {
        const edge = this.edges.get(id) ?? new Graphics()
        if (!this.edges.has(id)) {
          this.edges.set(id, edge)
          this.root.addChildAt(edge, 0)
          edge.eventMode = "static"
          edge.on("pointerover", () => this.options.interactions?.focusInput$.next(new Set([id])))
          edge.on("pointerout", () => this.options.interactions?.focusInput$.next(new Set()))
          edge.on("pointertap", () => this.options.interactions?.selectionInput$.next(new Set([id])))
        }
        const route = frame.geometry.routesById[id]
        const from = frame.geometry.endpointAnchorById[item.fromId]
        const to = frame.geometry.endpointAnchorById[item.toId]
        edge.clear()
        if (route && route.length >= 4) {
          edge.moveTo(route[0], route[1])
          for (let index = 2; index < route.length; index += 2) edge.lineTo(route[index], route[index + 1])
        } else if (from && to) {
          edge.moveTo(from.x, from.y).lineTo(to.x, to.y)
        }
        edge.stroke({ width: frame.presentation.focusedIds.has(id) ? 3 : 1.5, color: 0x78879d })
        edge.visible = !frame.presentation.hiddenIds.has(id)
        continue
      }

      const node = this.nodes.get(id) ?? new Graphics()
      if (!this.nodes.has(id)) {
        this.nodes.set(id, node)
        this.root.addChild(node)
        node.eventMode = "static"
        node.on("pointerover", () => this.options.interactions?.focusInput$.next(new Set([id])))
        node.on("pointerout", () => this.options.interactions?.focusInput$.next(new Set()))
        node.on("pointertap", () => this.options.interactions?.selectionInput$.next(new Set([id])))
      }
      const bounds = frame.geometry.boundsById[id]
      const anchor = frame.geometry.endpointAnchorById[id]
      node.clear()
      if (frame.presentation.sealedSvgArtifactsByRootId[id] !== undefined) {
        node.visible = false
        continue
      }
      if (bounds) {
        node.rect(bounds.x, bounds.y, bounds.width, bounds.height)
      } else if (anchor) {
        node.circle(anchor.x, anchor.y, 4)
      }
      node.fill({ color: frame.presentation.focusedIds.has(id) ? 0xf5a33b : 0x5b9bed })
      node.visible = !frame.presentation.hiddenIds.has(id)
    }

    const labelsById = frame.presentation.labelsById
    const headerIds = new Set(Object.keys(frame.geometry.headerBoundsById))
    const geometryChanged = this.labelGeometryRevisionId !== frame.geometry.revisionId
    const activeLabels = new Set(
      Object.keys(labelsById).filter(id => layoutIds.has(id) && frame.graph[id] !== undefined && !headerIds.has(id) && frame.presentation.sealedSvgArtifactsByRootId[id] === undefined),
    )
    for (const [id, label] of this.labels) {
      if (activeLabels.has(id)) continue
      label.destroy()
      this.labels.delete(id)
    }
    for (const id of activeLabels) {
      const item = frame.graph[id]
      const labelData = labelsById[id]
      if (item === undefined || labelData === undefined) continue
      const existing = this.labels.get(id)
      const label = existing ?? new Text({ text: labelData.text, style: { fill: 0xe9eef6, fontSize: 12 } })
      if (existing === undefined) {
        this.labels.set(id, label)
        this.labelOverlay.addChild(label)
      }
      if (label.text !== labelData.text) label.text = labelData.text
      if (label.anchor.x !== 0.5 || label.anchor.y !== 0.5) label.anchor.set(0.5)
      if (existing === undefined || geometryChanged || zoomChanged) {
        const position = labelPosition(frame, id)
        // Graph labels retain their fixed pixel font size during zoom; only their screen position changes.
        label.position.set(position.x * frame.camera.scale, position.y * frame.camera.scale)
      }
      label.visible = !frame.presentation.hiddenIds.has(id)
    }
    this.labelGeometryRevisionId = frame.geometry.revisionId

    const activeHeaders = new Set(frame.presentation.stickyHeaders.filter(header => header.visible && header.state === "stuck").map(header => header.id))
    for (const [id, header] of this.headers) {
      if (activeHeaders.has(id)) continue
      header.destroy()
      this.headers.delete(id)
    }
    for (const [id, label] of this.headerLabels) {
      if (activeHeaders.has(id) && labelsById[id] !== undefined) continue
      label.destroy()
      this.headerLabels.delete(id)
    }
    for (const placement of frame.presentation.stickyHeaders) {
      if (!placement.visible || placement.state !== "stuck") continue
      const bounds = frame.geometry.headerBoundsById[placement.id]
      if (!bounds) continue
      const header = this.headers.get(placement.id) ?? new Graphics()
      if (!this.headers.has(placement.id)) {
        this.headers.set(placement.id, header)
        this.overlay.addChild(header)
      }
      header
        .clear()
        .rect(
          bounds.x * frame.camera.scale + frame.camera.x,
          placement.top,
          bounds.width * frame.camera.scale,
          bounds.height * frame.camera.scale,
        )
        .fill({ color: 0x253753, alpha: 0.94 })
      const labelData = labelsById[placement.id]
      if (labelData === undefined) continue
      const label = this.headerLabels.get(placement.id) ?? new Text({ text: labelData.text, style: { fill: 0xe9eef6, fontSize: 12 } })
      if (!this.headerLabels.has(placement.id)) {
        this.headerLabels.set(placement.id, label)
        this.overlay.addChild(label)
      }
      if (label.text !== labelData.text) label.text = labelData.text
      if (label.anchor.x !== 0 || label.anchor.y !== 0) label.anchor.set(0, 0)
      label.position.set(bounds.x * frame.camera.scale + frame.camera.x, placement.top)
    }

    this.renderSealedSvgs(frame, layoutIds)

    this.root.position.set(frame.camera.x, frame.camera.y)
    this.root.scale.set(frame.camera.scale)
    this.app.renderer.render(this.app.stage)
    if (this.host.dataset !== undefined) {
      this.host.dataset.graphtRenderer = "pixi"
      this.host.dataset.graphtItemCount = String(Object.keys(frame.graph).length)
      this.host.dataset.graphtInteractiveBindingCount = String([...this.sealedSvgScenes.values()].reduce((count, entry) => count + entry.interactiveBindingCount, 0))
      const movable = this.movableDisplays.values().next().value
      if (movable !== undefined) this.host.dataset.graphtMovablePosition = JSON.stringify(movable.getGlobalPosition())
    }
  }

  renderSealedSvgs(frame: GraphFrame, layoutIds: ReadonlySet<string>): void {
    const artifacts = frame.presentation.sealedSvgArtifactsByRootId
    const activeRootIds = new Set(
      Object.keys(artifacts).filter(rootId => layoutIds.has(rootId) && frame.geometry.boundsById[rootId] !== undefined),
    )
    for (const rootId of [...this.sealedSvgPlacementsByRootId.keys()]) {
      if (activeRootIds.has(rootId)) continue
      this.sealedSvgPlacementsByRootId.delete(rootId)
      this.sealedSvgLoadRevisionByRootId.delete(rootId)
      this.removeSealedSvgSprite(rootId)
      this.removeSealedSvgScene(rootId)
    }
    for (const rootId of [...activeRootIds].sort()) {
      const artifact = artifacts[rootId]
      const bounds = frame.geometry.boundsById[rootId]
      if (artifact === undefined || bounds === undefined) continue
      this.sealedSvgPlacementsByRootId.set(rootId, { artifact, bounds })
      const existing = this.sealedSvgSprites.get(rootId)
      const existingScene = this.sealedSvgScenes.get(rootId)
      if (this.options.sealedSvgLoader === undefined) {
        if (existingScene?.revisionId !== artifact.revisionId) {
          this.removeSealedSvgScene(rootId)
          this.addSealedSvgScene(artifact)
        }
        const sceneEntry = this.sealedSvgScenes.get(rootId)
        if (sceneEntry !== undefined) {
          this.positionSealedSvgScene(sceneEntry.scene, artifact, bounds)
          for (const [graphId, displays] of sceneEntry.displaysByGraphId) {
            const delta = frame.presentation.translationsById?.[graphId] ?? { x: 0, y: 0 }
            for (const entry of displays) entry.display.position.set(entry.x + delta.x / sceneEntry.scene.scale.x, entry.y + delta.y / sceneEntry.scene.scale.y)
          }
        }
        continue
      }
      if (existing !== undefined && existing.revisionId === artifact.revisionId) {
        this.positionSealedSvg(existing.sprite, artifact, bounds)
        continue
      }
      if (existing !== undefined) this.removeSealedSvgSprite(rootId)
      if (this.sealedSvgLoadRevisionByRootId.get(rootId) === artifact.revisionId) continue
      this.sealedSvgLoadRevisionByRootId.set(rootId, artifact.revisionId)
      void this.loadSealedSvg(rootId, artifact)
    }
  }

  addSealedSvgScene(artifact: SealedSvgArtifact): void {
    const root = svgRootForPixi(this.host.ownerDocument, artifact.svg)
    for (const masked of root.querySelectorAll("[mask]")) masked.removeAttribute("mask")
    for (const mask of root.querySelectorAll("mask")) mask.remove()
    const scene = new SVGScene(root)
    const displayByElement = (scene as unknown as { _elementToRenderNode: Map<SVGElement, Container | null> })._elementToRenderNode
    replaceSvgTextNodes(root, displayByElement, this.app.renderer.resolution)
    let interactiveBindingCount = 0
    const mutableDisplaysByGraphId = new Map<string, { display: Container; x: number; y: number }[]>()
    for (const binding of artifact.bindings ?? []) {
      const element = root.querySelector(`[id="${CSS.escape(binding.elementId)}"]`)
      const display = element instanceof SVGElement ? displayByElement.get(element) : undefined
      if (display == null) continue
      if (binding.role === "message-line") display.renderable = false
      const displays = mutableDisplaysByGraphId.get(binding.graphId) ?? []
      if (!displays.some(entry => entry.display === display)) {
        displays.push({ display, x: display.position.x, y: display.position.y })
        mutableDisplaysByGraphId.set(binding.graphId, displays)
      }
      display.eventMode = "static"
      display.on("pointerover", () => this.options.interactions?.focusInput$.next(new Set([binding.graphId])))
      display.on("pointerout", () => this.options.interactions?.focusInput$.next(new Set()))
      display.on("pointertap", () => this.options.interactions?.selectionInput$.next(new Set([binding.graphId])))
      if (binding.role === "actor-shape") {
        this.movableDisplays.set(binding.graphId, display)
        let previous: { x: number; y: number } | undefined
        const move = (event: FederatedPointerEvent): void => {
          if (previous === undefined) return
          const current = { x: event.global.x, y: event.global.y }
          this.options.interactions?.moveInput$?.next({ id: binding.graphId, dx: (current.x - previous.x) / this.camera.scale, dy: (current.y - previous.y) / this.camera.scale })
          previous = current
        }
        const end = (): void => { previous = undefined }
        display.cursor = "move"
        display.on("pointerdown", event => {
          event.stopPropagation()
          previous = { x: event.global.x, y: event.global.y }
        })
        display.on("globalpointermove", move)
        display.on("pointerup", end)
        display.on("pointerupoutside", end)
      }
      interactiveBindingCount += 1
    }
    scene.drawPaints(this.app.renderer)
    this.sealedSvgScenes.set(artifact.rootId, { revisionId: artifact.revisionId, scene, interactiveBindingCount, displaysByGraphId: mutableDisplaysByGraphId })
    this.root.addChild(scene)
  }

  removeSealedSvgScene(rootId: string): void {
    const entry = this.sealedSvgScenes.get(rootId)
    if (entry === undefined) return
    entry.scene.destroy({ children: true })
    this.sealedSvgScenes.delete(rootId)
    this.movableDisplays.clear()
  }

  async loadSealedSvg(rootId: string, artifact: SealedSvgArtifact): Promise<void> {
    let resource: PixiSealedSvgResource | undefined
    try {
      resource = await (this.options.sealedSvgLoader ?? loadSealedSvgTexture)(artifact)
      const placement = this.sealedSvgPlacementsByRootId.get(rootId)
      if (this.unsubscribed || this.sealedSvgLoadRevisionByRootId.get(rootId) !== artifact.revisionId || placement === undefined || placement.artifact.revisionId !== artifact.revisionId) {
        await resource.unsubscribe()
        return
      }
      const sprite = new Sprite(resource.texture)
      this.sealedSvgSprites.set(rootId, { revisionId: artifact.revisionId, sprite, resource })
      this.root.addChild(sprite)
      this.positionSealedSvg(sprite, placement.artifact, placement.bounds)
      this.app.renderer.render(this.app.stage)
    } catch {
      await resource?.unsubscribe()
      if (this.sealedSvgLoadRevisionByRootId.get(rootId) === artifact.revisionId) {
        this.sealedSvgLoadRevisionByRootId.delete(rootId)
      }
    }
  }

  positionSealedSvg(sprite: Sprite | SVGScene, artifact: SealedSvgArtifact, bounds: { x: number; y: number; width: number; height: number }): void {
    const transform = sealedGeometryTransformOf(artifact.sourceBounds, bounds, artifact.fit)
    sprite.position.set(
      transform.translateX + artifact.sourceBounds.x * transform.scaleX,
      transform.translateY + artifact.sourceBounds.y * transform.scaleY,
    )
    sprite.scale.set(transform.scaleX, transform.scaleY)
  }

  positionSealedSvgScene(scene: SVGScene, artifact: SealedSvgArtifact, bounds: { x: number; y: number; width: number; height: number }): void {
    const transform = sealedGeometryTransformOf(artifact.sourceBounds, bounds, artifact.fit)
    scene.position.set(transform.translateX, transform.translateY)
    scene.scale.set(transform.scaleX, transform.scaleY)
  }

  removeSealedSvgSprite(rootId: string): void {
    const entry = this.sealedSvgSprites.get(rootId)
    if (entry === undefined) return
    entry.sprite.destroy()
    void entry.resource.unsubscribe()
    this.sealedSvgSprites.delete(rootId)
  }

  unsubscribe(): void {
    if (this.unsubscribed) return
    this.unsubscribed = true
    for (const unsubscribe of this.eventUnsubscribes.splice(0)) unsubscribe()
    for (const label of this.labels.values()) label.destroy()
    for (const label of this.headerLabels.values()) label.destroy()
    this.labels.clear()
    this.headerLabels.clear()
    for (const rootId of [...this.sealedSvgSprites.keys()]) this.removeSealedSvgSprite(rootId)
    for (const rootId of [...this.sealedSvgScenes.keys()]) this.removeSealedSvgScene(rootId)
    this.sealedSvgLoadRevisionByRootId.clear()
    this.sealedSvgPlacementsByRootId.clear()
    if (this.initialized) this.app.destroy(true, { children: true })
  }
}

export function pixiGraphRenderer(options: PixiGraphRendererOptions = {}): GraphRenderer {
  return host =>
    source$ =>
      source$.pipe(
        connect(
          shared$ =>
            defer(() => {
              const resource = new PixiGraphFrameResource(host, options)
              return from(resource.init()).pipe(
                switchMap(() =>
                  shared$.pipe(
                    tap(frame => {
                      const previousIds = new Set([...resource.nodes.keys(), ...resource.edges.keys()])
                      resource.render(frame, graphRenderReceipt(previousIds, frame))
                    }),
                  ),
                ),
                finalize(() => resource.unsubscribe()),
              )
            }),
          { connector: () => new ReplaySubject<GraphFrame>(1) },
        ),
      )
}
