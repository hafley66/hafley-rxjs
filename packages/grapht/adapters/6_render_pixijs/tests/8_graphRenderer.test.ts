import { Subject } from "rxjs"
import { describe, expect, it, vi } from "vitest"
import { Texture } from "pixi.js"
import type { GraphCamera, GraphFrame, RendererInteractions } from "@hafley66/grapht"

const state = vi.hoisted(() => ({
  resolveInit: undefined as (() => void) | undefined,
  appended: 0,
  destroyed: 0,
  rendered: 0,
  textWrites: 0,
  anchorWrites: 0,
  texts: [] as Array<{ text: string; destroyed: boolean }>,
  sprites: [] as Array<{ destroyed: boolean }>,
  textures: [] as Array<{ destroyed: boolean }>,
}))

vi.mock("pixi.js", () => {
  class Container {
    position = {
      x: 0,
      y: 0,
      set: (x: number, y: number) => {
        this.position.x = x
        this.position.y = y
      },
    }
    scale = {
      x: 1,
      y: 1,
      set: (x: number, y: number) => {
        this.scale.x = x
        this.scale.y = y
      },
    }
    children: unknown[] = []
    addChild(child: unknown) { this.children.push(child) }
    addChildAt(child: unknown) { this.children.push(child) }
  }
  class Graphics {
    eventMode = "none"
    clear() { return this }
    rect() { return this }
    circle() { return this }
    moveTo() { return this }
    lineTo() { return this }
    fill() { return this }
    stroke() { return this }
    on() { return this }
    destroy() {}
    visible = true
  }
  class Text {
    value: string
    destroyed = false
    visible = true
    position = {
      x: 0,
      y: 0,
      set: (x: number, y: number) => {
        this.position.x = x
        this.position.y = y
      },
    }
    anchor = {
      x: 0,
      y: 0,
      set: (x: number, y = x) => {
        state.anchorWrites++
        this.anchor.x = x
        this.anchor.y = y
      },
    }
    constructor(options: { text: string }) {
      this.value = options.text
      state.texts.push(this)
    }
    get text() {
      return this.value
    }
    set text(value: string) {
      state.textWrites++
      this.value = value
    }
    destroy() {
      this.destroyed = true
    }
  }
  class Texture {
    destroyed = false
    constructor() { state.textures.push(this) }
    destroy() { this.destroyed = true }
  }
  class Sprite {
    destroyed = false
    position = {
      x: 0,
      y: 0,
      set: (x: number, y: number) => {
        this.position.x = x
        this.position.y = y
      },
    }
    scale = {
      x: 1,
      y: 1,
      set: (x: number, y: number) => {
        this.scale.x = x
        this.scale.y = y
      },
    }
    constructor(readonly texture: Texture) { state.sprites.push(this) }
    destroy() { this.destroyed = true }
  }
  class Application {
    canvas = {}
    stage = new Container()
    ticker = { stop() {} }
    renderer = { render: () => state.rendered++ }
    init() {
      return new Promise<void>(resolve => {
        state.resolveInit = resolve
      })
    }
    destroy() {
      state.destroyed++
    }
  }
  return { Application, Assets: { load: () => Promise.reject(new Error("unexpected default SVG loader")) }, Container, Graphics, Sprite, Text, Texture }
})

import { PixiGraphFrameResource, pixiGraphRenderer } from "../src/8_graphRenderer.js"

const frame: GraphFrame = {
  graph: { a: { id: "a", type: "node" } },
  geometry: {
    revisionId: "one",
    boundsById: { a: { x: 1, y: 2, width: 3, height: 4 } },
    endpointAnchorById: { a: { x: 2.5, y: 4 } },
    routesById: {},
    headerBoundsById: {},
  },
  camera: { x: 0, y: 0, scale: 1, viewport: { x: 0, y: 0, width: 100, height: 80 } },
  presentation: {
    stickyHeaders: [],
    hiddenIds: new Set(),
    focusedIds: new Set(),
    labelsById: { a: { text: "a" } },
    sealedSvgArtifactsByRootId: {},
  },
}

describe("Pixi GraphFrame renderer", () => {
  it("replays the latest frame after async init and tears down on unsubscribe", async () => {
    Object.assign(state, { resolveInit: undefined, appended: 0, destroyed: 0, rendered: 0 })
    const frames$ = new Subject<GraphFrame>()
    const host = { appendChild: () => state.appended++ } as unknown as HTMLElement
    const seen: string[] = []
    const subscription = frames$.pipe(pixiGraphRenderer()(host)).subscribe(value => seen.push(value.geometry.revisionId))

    frames$.next(frame)
    expect({ appended: state.appended, rendered: state.rendered, seen }).toMatchInlineSnapshot(`
      {
        "appended": 0,
        "rendered": 0,
        "seen": [],
      }
    `)

    state.resolveInit?.()
    await Promise.resolve()
    await Promise.resolve()
    expect({ appended: state.appended, rendered: state.rendered, seen }).toMatchInlineSnapshot(`
      {
        "appended": 1,
        "rendered": 1,
        "seen": [
          "one",
        ],
      }
    `)

    subscription.unsubscribe()
    expect(state.destroyed).toBe(1)
  })

  it("publishes captured pointer pan and wheel camera input", async () => {
    const listeners = new Map<string, EventListener>()
    const host = {
      appendChild() {},
      addEventListener: (type: string, listener: EventListener) => listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
      setPointerCapture() {},
      releasePointerCapture() {},
    } as unknown as HTMLElement
    const cameraInput$ = new Subject<GraphCamera>()
    const interactions: RendererInteractions = {
      cameraInput$,
      focusInput$: new Subject(),
      selectionInput$: new Subject(),
    }
    const cameras: GraphCamera[] = []
    cameraInput$.subscribe(camera => cameras.push(camera))
    const resource = new PixiGraphFrameResource(host, { interactions })
    const initialized = resource.init()
    state.resolveInit?.()
    await initialized
    resource.camera = frame.camera

    listeners.get("pointerdown")?.({ pointerId: 4, clientX: 10, clientY: 20 } as PointerEvent)
    listeners.get("pointermove")?.({ pointerId: 4, clientX: 16, clientY: 29 } as PointerEvent)
    listeners.get("wheel")?.({ deltaX: 0, deltaY: 12, ctrlKey: false, metaKey: false, preventDefault() {} } as WheelEvent)
    resource.unsubscribe()

    expect({ cameras, remainingListeners: [...listeners.keys()] }).toMatchInlineSnapshot(`
      {
        "cameras": [
          {
            "scale": 1,
            "viewport": {
              "height": 80,
              "width": 100,
              "x": 0,
              "y": 0,
            },
            "x": 6,
            "y": 9,
          },
          {
            "scale": 1,
            "viewport": {
              "height": 80,
              "width": 100,
              "x": 0,
              "y": 0,
            },
            "x": 6,
            "y": -3,
          },
        ],
        "remainingListeners": [],
      }
    `)
  })

  it("retains canonical node, edge, and sticky-header labels across updates and cleans them up", () => {
    Object.assign(state, { texts: [] })
    const resource = new PixiGraphFrameResource({} as HTMLElement, {})
    const labeledFrame: GraphFrame = {
      graph: {
        group: { id: "group", type: "node" },
        a: { id: "a", type: "node", parentId: "group" },
        b: { id: "b", type: "node", parentId: "group" },
        ab: { id: "ab", type: "edge", fromId: "a", toId: "b", direction: "forward", parentId: "group" },
      },
      geometry: {
        revisionId: "labels-one",
        boundsById: { a: { x: 2, y: 4, width: 10, height: 8 } },
        endpointAnchorById: { a: { x: 7, y: 8 }, b: { x: 27, y: 8 } },
        routesById: { ab: new Float32Array([7, 8, 27, 8]) },
        headerBoundsById: { group: { x: 3, y: 4, width: 24, height: 10 } },
      },
      camera: { x: 5, y: 6, scale: 2, viewport: { x: 0, y: 0, width: 100, height: 80 } },
      presentation: {
        stickyHeaders: [{ id: "group", depth: 0, top: 9, visible: true, state: "stuck" }],
        hiddenIds: new Set(),
        focusedIds: new Set(),
        labelsById: { group: { text: "Group" }, a: { text: "Alice" }, ab: { text: "calls" } },
        sealedSvgArtifactsByRootId: {},
      },
    }

    resource.render(labeledFrame, { enterIds: Object.keys(labeledFrame.graph), updateIds: [], exitIds: [] })
    const nodeLabel = resource.labels.get("a")
    const edgeLabel = resource.labels.get("ab")
    const headerLabel = resource.headerLabels.get("group")
    const initialLabels = { graph: [...resource.labels.keys()], headers: [...resource.headerLabels.keys()] }
    resource.render(
      {
        ...labeledFrame,
        presentation: { ...labeledFrame.presentation, labelsById: { group: { text: "Group" }, a: { text: "Alicia" }, ab: { text: "calls" } } },
      },
      { enterIds: [], updateIds: Object.keys(labeledFrame.graph), exitIds: [] },
    )
    resource.render(
      { ...labeledFrame, graph: { group: labeledFrame.graph.group, a: labeledFrame.graph.a, b: labeledFrame.graph.b }, presentation: { ...labeledFrame.presentation, labelsById: { group: { text: "Group" }, a: { text: "Alicia" } } } },
      { enterIds: [], updateIds: ["group", "a", "b"], exitIds: ["ab"] },
    )
    resource.unsubscribe()

    expect({
      retained: {
        node: nodeLabel === state.texts[0],
        edge: edgeLabel === state.texts[1],
        header: headerLabel === state.texts[2],
      },
      beforeExit: {
        node: { text: nodeLabel?.text, position: nodeLabel?.position, anchor: nodeLabel?.anchor },
        edge: { text: edgeLabel?.text, position: edgeLabel?.position, anchor: edgeLabel?.anchor },
        header: { text: headerLabel?.text, position: headerLabel?.position, anchor: headerLabel?.anchor },
      },
      parented: {
        nodeInLabelOverlay: resource.labelOverlay.children.includes(nodeLabel!),
        edgeInLabelOverlay: resource.labelOverlay.children.includes(edgeLabel!),
        rootHasNode: resource.root.children.includes(nodeLabel!),
        headerInStickyOverlay: resource.overlay.children.includes(headerLabel!),
      },
      initialLabels,
      remaining: { labels: [...resource.labels.keys()], headers: [...resource.headerLabels.keys()] },
      destroyed: state.texts.map(text => text.destroyed),
    }).toMatchInlineSnapshot(`
      {
        "beforeExit": {
          "edge": {
            "anchor": {
              "set": [Function],
              "x": 0.5,
              "y": 0.5,
            },
            "position": {
              "set": [Function],
              "x": 34,
              "y": 16,
            },
            "text": "calls",
          },
          "header": {
            "anchor": {
              "set": [Function],
              "x": 0,
              "y": 0,
            },
            "position": {
              "set": [Function],
              "x": 11,
              "y": 9,
            },
            "text": "Group",
          },
          "node": {
            "anchor": {
              "set": [Function],
              "x": 0.5,
              "y": 0.5,
            },
            "position": {
              "set": [Function],
              "x": 14,
              "y": 16,
            },
            "text": "Alicia",
          },
        },
        "destroyed": [
          true,
          true,
          true,
        ],
        "initialLabels": {
          "graph": [
            "a",
            "ab",
          ],
          "headers": [
            "group",
          ],
        },
        "parented": {
          "edgeInLabelOverlay": true,
          "headerInStickyOverlay": true,
          "nodeInLabelOverlay": true,
          "rootHasNode": false,
        },
        "remaining": {
          "headers": [],
          "labels": [],
        },
        "retained": {
          "edge": true,
          "header": true,
          "node": true,
        },
      }
    `)
  })

  it("translates the fixed-size label overlay on pan without rewriting retained labels", () => {
    Object.assign(state, { texts: [], textWrites: 0, anchorWrites: 0 })
    const resource = new PixiGraphFrameResource({} as HTMLElement, {})
    resource.render(frame, { enterIds: ["a"], updateIds: [], exitIds: [] })
    const label = resource.labels.get("a")!
    const position = vi.spyOn(label.position, "set")
    const overlayTranslation = vi.spyOn(resource.labelOverlay.position, "set")
    Object.assign(state, { textWrites: 0, anchorWrites: 0 })

    resource.render(
      { ...frame, camera: { ...frame.camera, x: 13, y: 17 } },
      { enterIds: [], updateIds: ["a"], exitIds: [] },
    )

    expect({
      textWrites: state.textWrites,
      anchorWrites: state.anchorWrites,
      labelPositionWrites: position.mock.calls.length,
      overlayTranslations: overlayTranslation.mock.calls,
    }).toMatchInlineSnapshot(`
      {
        "anchorWrites": 0,
        "labelPositionWrites": 0,
        "overlayTranslations": [
          [
            13,
            17,
          ],
        ],
        "textWrites": 0,
      }
    `)
  })

  it("retains sealed SVG sprites, suppresses stale async loads, and destroys owned textures", async () => {
    Object.assign(state, { sprites: [], textures: [] })
    const pending = new Map<string, (texture: InstanceType<typeof Texture>) => void>()
    const loader = (artifact: { revisionId: string }) =>
      new Promise<InstanceType<typeof Texture>>(resolve => pending.set(artifact.revisionId, resolve)).then(texture => ({
        texture,
        unsubscribe: () => texture.destroy(true),
      }))
    const resource = new PixiGraphFrameResource({} as HTMLElement, { sealedSvgLoader: loader })
    const sealedFrame: GraphFrame = {
      graph: {
        sequence: { id: "sequence", type: "node", layout: { mode: "sealed", bounds: { x: 10, y: 20, width: 100, height: 200 }, geometryRevisionId: "sequence:geometry:1" } },
        group: { id: "group", type: "node", parentId: "sequence" },
        actor: { id: "actor", type: "node", parentId: "group", data: { layout: "renderer-data-is-ignored" } },
        message: { id: "message", type: "edge", parentId: "group", fromId: "actor", toId: "actor", direction: "forward" },
        sibling: { id: "sibling", type: "node" },
      },
      geometry: {
        revisionId: "outer:1",
        boundsById: { sequence: { x: 100, y: 200, width: 300, height: 100 }, sibling: { x: 10, y: 10, width: 20, height: 20 } },
        endpointAnchorById: { sequence: { x: 250, y: 250 }, sibling: { x: 20, y: 20 } },
        routesById: {},
        headerBoundsById: {},
      },
      camera: { x: 4, y: 5, scale: 2, viewport: { x: 0, y: 0, width: 100, height: 80 } },
      presentation: {
        stickyHeaders: [], hiddenIds: new Set(), focusedIds: new Set(), labelsById: {},
        sealedSvgArtifactsByRootId: {
          sequence: { rootId: "sequence", revisionId: "sequence:svg:1", geometryRevisionId: "sequence:geometry:1", svg: "<svg/>", sourceBounds: { x: 10, y: 20, width: 100, height: 200 }, fit: "contain" },
        },
      },
    }

    resource.render(sealedFrame, { enterIds: Object.keys(sealedFrame.graph), updateIds: [], exitIds: [] })
    const replacement = {
      ...sealedFrame,
      presentation: {
        ...sealedFrame.presentation,
        sealedSvgArtifactsByRootId: {
          sequence: { ...sealedFrame.presentation.sealedSvgArtifactsByRootId.sequence, revisionId: "sequence:svg:2" },
        },
      },
    }
    resource.render(replacement, { enterIds: [], updateIds: Object.keys(replacement.graph), exitIds: [] })
    const staleTexture = new Texture()
    pending.get("sequence:svg:1")?.(staleTexture)
    await Promise.resolve()
    await Promise.resolve()
    const currentTexture = new Texture()
    pending.get("sequence:svg:2")?.(currentTexture)
    await Promise.resolve()
    await Promise.resolve()
    const sprite = resource.sealedSvgSprites.get("sequence")?.sprite
    resource.render({ ...replacement, camera: { ...replacement.camera, x: 14, y: 15, scale: 3 } }, { enterIds: [], updateIds: Object.keys(replacement.graph), exitIds: [] })
    const retainedSprite = resource.sealedSvgSprites.get("sequence")?.sprite
    resource.render({ ...replacement, presentation: { ...replacement.presentation, sealedSvgArtifactsByRootId: {} } }, { enterIds: [], updateIds: Object.keys(replacement.graph), exitIds: [] })
    const result = {
      nativeMaps: { nodes: [...resource.nodes.keys()], edges: [...resource.edges.keys()] },
      staleTextureDestroyed: staleTexture.destroyed,
      retainedSprite: sprite === retainedSprite,
      sprite: { position: sprite?.position, scale: sprite?.scale },
      camera: { rootPosition: { x: resource.root.position.x, y: resource.root.position.y }, rootScale: { x: resource.root.scale.x, y: resource.root.scale.y } },
      currentTextureDestroyedOnArtifactExit: currentTexture.destroyed,
      spritesAfterArtifactExit: [...resource.sealedSvgSprites.keys()],
    }
    resource.unsubscribe()

    expect(result).toMatchInlineSnapshot(`
      {
        "camera": {
          "rootPosition": {
            "x": 4,
            "y": 5,
          },
          "rootScale": {
            "x": 2,
            "y": undefined,
          },
        },
        "currentTextureDestroyedOnArtifactExit": true,
        "nativeMaps": {
          "edges": [],
          "nodes": [
            "sequence",
            "sibling",
          ],
        },
        "retainedSprite": true,
        "sprite": {
          "position": {
            "set": [Function],
            "x": 225,
            "y": 200,
          },
          "scale": {
            "set": [Function],
            "x": 0.5,
            "y": 0.5,
          },
        },
        "spritesAfterArtifactExit": [],
        "staleTextureDestroyed": true,
      }
    `)
  })
})
