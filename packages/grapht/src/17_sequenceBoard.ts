import {
  decorateSvg,
  documentFingerprint,
  type NativeRenderReceipt,
  resolveSequenceFocus,
  type SequenceArtifact,
  type SequenceFocus,
  type SvgBindingReceipt,
} from "@hafley66/grapht-model"
import type { SequenceGeometry } from "./15_sequenceGeometry.js"

export type SequenceCamera = { x: number; y: number; scale: number }
export type SequenceBoardInput = {
  artifact: SequenceArtifact
  bindingReceipt: SvgBindingReceipt
  geometry: SequenceGeometry
  renderReceipt: NativeRenderReceipt
}
export type SequenceBoardReceipt = {
  mounted: boolean
  renderRevisionId?: string
  geometryId?: string
  camera: SequenceCamera
  focus: SequenceFocus
  actorLabelIds: string[]
  focusOverlayActorIds: string[]
  listenerCount: number
}
export type SequenceBoard = {
  replace(input: SequenceBoardInput): void
  setCamera(camera: SequenceCamera): void
  focus(occurrenceId: string): void
  receipt(): SequenceBoardReceipt
  listenerCount(): number
  unmount(): void
}

const EMPTY_FOCUS: SequenceFocus = { actorIds: [], groupIds: [] }
const SVG_NAMESPACE = "http://www.w3.org/2000/svg"

function cloneFocus(focus: SequenceFocus): SequenceFocus {
  return {
    ...(focus.hoveredOccurrenceId ? { hoveredOccurrenceId: focus.hoveredOccurrenceId } : {}),
    actorIds: [...focus.actorIds],
    groupIds: [...focus.groupIds],
  }
}

function bindingElement(
  input: SequenceBoardInput,
  svg: SVGSVGElement,
  occurrenceId: string,
  role: SequenceArtifact["bindings"][number]["role"],
): Element | undefined {
  const binding = input.artifact.bindings.find(item => item.occurrenceId === occurrenceId && item.role === role)
  return binding ? svg.querySelector(`[id="${binding.elementId}"]`) ?? undefined : undefined
}

function commonAncestor(left: Element, right: Element): Element {
  const leftAncestors = new Set<Element>()
  let ancestor: Element | null = left
  while (ancestor) {
    leftAncestors.add(ancestor)
    ancestor = ancestor.parentElement
  }
  ancestor = right
  while (ancestor && !leftAncestors.has(ancestor)) ancestor = ancestor.parentElement
  return ancestor ?? left
}

function cloneWithoutIdentity(element: Element): SVGElement {
  const clone = element.cloneNode(true) as SVGElement
  for (const item of [clone, ...clone.querySelectorAll("*")]) {
    item.removeAttribute("id")
    item.removeAttribute("data-sequence-occurrence-id")
  }
  return clone
}

function groupDepth(artifact: SequenceArtifact, occurrenceId: string): number {
  let depth = 0
  let parentId = artifact.occurrences.find(occurrence => occurrence.id === occurrenceId)?.parentId
  while (parentId) {
    const parent = artifact.occurrences.find(occurrence => occurrence.id === parentId)
    if (!parent) break
    if (parent.kind === "group") depth += 1
    parentId = parent.parentId
  }
  return depth
}

export function createSequenceBoard(host: HTMLElement, viewport: { width: number; height: number }): SequenceBoard {
  let current: SequenceBoardInput | undefined
  let camera: SequenceCamera = { x: 0, y: 0, scale: 1 }
  let focus = cloneFocus(EMPTY_FOCUS)
  let listeners = 0

  host.style.cssText = `position:relative;overflow:hidden;width:${viewport.width}px;height:${viewport.height}px`

  const pointerOver = (event: PointerEvent) => {
    const target =
      event.target instanceof Element ? event.target.closest<HTMLElement>("[data-sequence-occurrence-id]") : undefined
    const occurrenceId = target?.dataset.sequenceOccurrenceId
    if (occurrenceId) updateFocus(occurrenceId)
  }
  const pointerOut = (event: PointerEvent) => {
    const target =
      event.target instanceof Element ? event.target.closest<HTMLElement>("[data-sequence-occurrence-id]") : undefined
    if (target) updateFocus(undefined)
  }

  host.addEventListener("pointerover", pointerOver)
  host.addEventListener("pointerout", pointerOut)
  listeners = 2

  const updateFocus = (occurrenceId: string | undefined) => {
    focus = current && occurrenceId ? resolveSequenceFocus(current.artifact, occurrenceId) : cloneFocus(EMPTY_FOCUS)
    renderState()
  }

  const renderState = () => {
    if (!current) return
    const scene = host.querySelector<HTMLElement>("[data-sequence-scene]")
    if (scene) scene.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`

    const focusedActors = new Set(focus.actorIds)
    const actorOverlay = host.querySelector<SVGSVGElement>("[data-sequence-actor-overlay]")
    if (actorOverlay) {
      actorOverlay.style.transform = `translate(${camera.x}px, 0) scale(${camera.scale})`
    }
    for (const actor of host.querySelectorAll<SVGElement>("[data-sequence-sticky-actor-id]")) {
      const focused = focusedActors.has(actor.dataset.sequenceStickyActorId ?? "")
      actor.dataset.focused = focused ? "true" : "false"
      actor.style.opacity = focusedActors.size === 0 || focused ? "1" : "0.5"
      actor.style.filter = focused ? "drop-shadow(0 0 3px #0d32b2)" : ""
    }

    const groupOverlay = host.querySelector<SVGSVGElement>("[data-sequence-group-overlay]")
    if (groupOverlay) groupOverlay.style.transform = `translate(${camera.x}px, 0) scale(${camera.scale})`
    const actorHeight = Number(actorOverlay?.dataset.sequenceActorHeight ?? 0) * camera.scale
    const stickyGroups = [...host.querySelectorAll<SVGElement>("[data-sequence-sticky-group-id]")]
      .sort((left, right) => Number(left.dataset.sequenceGroupDepth) - Number(right.dataset.sequenceGroupDepth))
    let visibleGroupIndex = 0
    for (const group of stickyGroups) {
      const worldY = Number(group.dataset.sequenceWorldY)
      const cloneY = Number(group.dataset.sequenceCloneY)
      const frameBottom = Number(group.dataset.sequenceFrameBottom)
      const height = Number(group.dataset.sequenceHeight)
      const slot = actorHeight + 4 + visibleGroupIndex * (height * camera.scale + 4)
      const natural = worldY * camera.scale + camera.y
      const active = frameBottom * camera.scale + camera.y > slot
      group.style.display = active ? "" : "none"
      if (!active) continue
      const target = Math.max(natural, slot)
      group.setAttribute("transform", `translate(0 ${(target / camera.scale) - cloneY})`)
      if (natural <= slot) visibleGroupIndex += 1
    }

    const overlay = host.querySelector<HTMLElement>("[data-sequence-focus-overlay]")
    if (!overlay) return
    overlay.replaceChildren()
    const actors = new Map(
      current.artifact.occurrences.filter(occurrence => occurrence.kind === "actor").map(actor => [actor.id, actor]),
    )
    const labels = new Map(
      current.geometry.entities
        .filter(entity => entity.role === "actor-label")
        .map(entity => [entity.occurrenceId, entity]),
    )
    for (const actorId of focus.actorIds) {
      const entity = labels.get(actorId)
      const actor = actors.get(actorId)
      if (!entity || !actor) continue
      const x = (entity.worldBounds.x - current.geometry.viewBox.x) * camera.scale + camera.x
      if (x >= 0 && x <= viewport.width) continue
      const item = document.createElement("span")
      item.dataset.sequenceFocusActorId = actorId
      item.textContent = actor.label ?? actorId
      overlay.append(item)
    }
  }

  const replace = (input: SequenceBoardInput) => {
    if (input.artifact.bindingRevision.renderRevisionId !== input.artifact.renderRevision.id) {
      throw new Error("sequence board artifact binding revision does not match artifact render revision")
    }
    if (input.geometry.renderRevisionId !== input.artifact.renderRevision.id) {
      throw new Error("sequence board geometry render revision does not match artifact")
    }
    if (
      documentFingerprint([input.bindingReceipt.bindings, input.bindingReceipt.elementPaths]) !==
      input.artifact.bindingRevision.bindingHash
    ) {
      throw new Error("sequence board binding receipt does not match artifact")
    }

    const shell = document.createElement("div")
    shell.dataset.sequenceBoard = "true"
    shell.style.cssText = "position:relative;width:100%;height:100%"
    const scene = document.createElement("div")
    scene.dataset.sequenceScene = "true"
    scene.style.cssText = "position:absolute;z-index:0;left:0;top:0;transform-origin:top left"
    scene.innerHTML = decorateSvg(input.renderReceipt, input.bindingReceipt)
    const svg = scene.querySelector<SVGSVGElement>("svg")
    if (!svg) throw new Error("sequence board render receipt has no SVG")
    svg.style.display = "block"
    svg.style.width = `${input.geometry.viewBox.width}px`
    svg.style.height = `${input.geometry.viewBox.height}px`

    for (const binding of input.artifact.bindings) {
      const element = svg.querySelector<HTMLElement>(`[id="${binding.elementId}"]`)
      if (element) element.dataset.sequenceOccurrenceId = binding.occurrenceId
    }

    const actorOverlay = document.createElementNS(SVG_NAMESPACE, "svg")
    actorOverlay.dataset.sequenceActorOverlay = "true"
    actorOverlay.setAttribute("viewBox", `${input.geometry.viewBox.x} ${input.geometry.viewBox.y} ${input.geometry.viewBox.width} ${input.geometry.viewBox.height}`)
    actorOverlay.setAttribute("width", String(input.geometry.viewBox.width))
    actorOverlay.setAttribute("height", String(input.geometry.viewBox.height))
    actorOverlay.style.cssText = "position:absolute;z-index:2;left:0;top:0;overflow:visible;pointer-events:none;transform-origin:0 0"
    const actors = new Map(
      input.artifact.occurrences.filter(occurrence => occurrence.kind === "actor").map(actor => [actor.id, actor]),
    )
    const actorShapes = new Map(
      input.geometry.entities.filter(entity => entity.role === "actor-shape").map(entity => [entity.occurrenceId, entity]),
    )
    const actorTop = Math.min(...[...actorShapes.values()].map(entity => entity.localBounds.y))
    const actorHeight = Math.max(...[...actorShapes.values()].map(entity => entity.localBounds.height))
    actorOverlay.dataset.sequenceActorTop = String(actorTop)
    actorOverlay.dataset.sequenceActorHeight = String(actorHeight)
    for (const [actorId, actor] of actors) {
      const shape = bindingElement(input, svg, actorId, "actor-shape")
      const label = bindingElement(input, svg, actorId, "actor-label")
      if (!shape || !label) continue
      const nativeRoot = commonAncestor(shape, label)
      const clone = cloneWithoutIdentity(nativeRoot)
      nativeRoot.setAttribute("visibility", "hidden")
      const sticky = document.createElementNS(SVG_NAMESPACE, "g")
      sticky.dataset.sequenceStickyActorId = actorId
      sticky.dataset.sequenceOccurrenceId = actorId
      sticky.setAttribute("aria-label", actor.label ?? actorId)
      sticky.setAttribute("transform", `translate(0 ${-actorTop})`)
      sticky.append(clone)
      actorOverlay.append(sticky)

      for (const role of ["actor-bottom-shape", "actor-bottom-label"] as const) {
        const bottom = bindingElement(input, svg, actorId, role)
        const bottomRoot = bottom?.closest("g") ?? bottom
        if (!bottomRoot) continue
        bottomRoot.setAttribute("visibility", "hidden")
        bottomRoot.setAttribute("data-sequence-bottom-actor", "hidden")
      }
    }

    const bottomTop = Math.min(
      ...input.geometry.entities
        .filter(entity => entity.role === "actor-bottom-shape")
        .map(entity => entity.worldBounds.y),
    )
    if (Number.isFinite(bottomTop)) {
      const visibleHeight = bottomTop - input.geometry.viewBox.y
      svg.setAttribute(
        "viewBox",
        `${input.geometry.viewBox.x} ${input.geometry.viewBox.y} ${input.geometry.viewBox.width} ${visibleHeight}`,
      )
      svg.style.height = `${visibleHeight}px`
    }

    const groupOverlay = document.createElementNS(SVG_NAMESPACE, "svg")
    groupOverlay.dataset.sequenceGroupOverlay = "true"
    groupOverlay.setAttribute("viewBox", `${input.geometry.viewBox.x} ${input.geometry.viewBox.y} ${input.geometry.viewBox.width} ${input.geometry.viewBox.height}`)
    groupOverlay.setAttribute("width", String(input.geometry.viewBox.width))
    groupOverlay.setAttribute("height", String(input.geometry.viewBox.height))
    groupOverlay.style.cssText = "position:absolute;z-index:1;left:0;top:0;overflow:visible;pointer-events:none;transform-origin:0 0"
    for (const group of input.artifact.occurrences.filter(occurrence => occurrence.kind === "group")) {
      const label = bindingElement(input, svg, group.id, "group-label")
      const geometry = input.geometry.entities.find(entity => entity.occurrenceId === group.id && entity.role === "group-label")
      const frames = input.geometry.entities.filter(entity => entity.occurrenceId === group.id && entity.role === "group-frame")
      if (!label || !geometry || frames.length === 0) continue
      const nativeLabel = label.closest("text") ?? label
      const clonedLabel = cloneWithoutIdentity(nativeLabel)
      nativeLabel.setAttribute("visibility", "hidden")
      const sticky = document.createElementNS(SVG_NAMESPACE, "g")
      sticky.dataset.sequenceStickyGroupId = group.id
      sticky.dataset.sequenceOccurrenceId = group.id
      sticky.dataset.sequenceGroupDepth = String(groupDepth(input.artifact, group.id))
      sticky.dataset.sequenceWorldY = String(geometry.worldBounds.y)
      sticky.dataset.sequenceCloneY = String(geometry.localBounds.y)
      sticky.dataset.sequenceHeight = String(Math.max(geometry.localBounds.height, 20))
      sticky.dataset.sequenceFrameBottom = String(
        Math.max(...frames.map(frame => frame.worldBounds.y + frame.worldBounds.height)),
      )
      const backdrop = document.createElementNS(SVG_NAMESPACE, "rect")
      backdrop.setAttribute("x", String(geometry.localBounds.x - 6))
      backdrop.setAttribute("y", String(geometry.localBounds.y - 3))
      backdrop.setAttribute("width", String(geometry.localBounds.width + 12))
      backdrop.setAttribute("height", String(Math.max(geometry.localBounds.height, 20) + 6))
      backdrop.setAttribute("rx", "3")
      backdrop.setAttribute("fill", "#eef1f8")
      backdrop.setAttribute("stroke", "#0d32b2")
      backdrop.setAttribute("fill-opacity", "0.96")
      sticky.append(backdrop, clonedLabel)
      groupOverlay.append(sticky)
    }

    const focusOverlay = document.createElement("div")
    focusOverlay.dataset.sequenceFocusOverlay = "true"
    focusOverlay.style.cssText = "position:absolute;z-index:3;right:4px;top:4px;display:flex;gap:4px;pointer-events:none"
    shell.append(scene, groupOverlay, actorOverlay, focusOverlay)

    current = input
    focus = cloneFocus(EMPTY_FOCUS)
    host.replaceChildren(shell)
    renderState()
  }

  return {
    replace,
    setCamera(nextCamera) {
      camera = { ...nextCamera }
      renderState()
    },
    focus(occurrenceId) {
      updateFocus(occurrenceId)
    },
    receipt() {
      const overlayActorIds = [...host.querySelectorAll<HTMLElement>("[data-sequence-focus-actor-id]")].map(
        item => item.dataset.sequenceFocusActorId ?? "",
      )
      return {
        mounted: Boolean(current),
        ...(current ? { renderRevisionId: current.artifact.renderRevision.id, geometryId: current.geometry.id } : {}),
        camera: { ...camera },
        focus: cloneFocus(focus),
        actorLabelIds: [...host.querySelectorAll<HTMLElement>("[data-sequence-sticky-actor-id]")].map(
          item => item.dataset.sequenceStickyActorId ?? "",
        ),
        focusOverlayActorIds: overlayActorIds,
        listenerCount: listeners,
      }
    },
    listenerCount() {
      return listeners
    },
    unmount() {
      host.removeEventListener("pointerover", pointerOver)
      host.removeEventListener("pointerout", pointerOut)
      listeners = 0
      current = undefined
      focus = cloneFocus(EMPTY_FOCUS)
      host.replaceChildren()
    },
  }
}
