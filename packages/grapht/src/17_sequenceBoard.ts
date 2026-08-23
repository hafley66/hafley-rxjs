import { decorateSvg, type NativeRenderReceipt, type SvgBindingReceipt } from "./13_sequenceSvgBinding.js"
import type { SequenceArtifact } from "./14_sequenceArtifact.js"
import type { SequenceGeometry } from "./15_sequenceGeometry.js"
import { resolveSequenceFocus, type SequenceFocus } from "./16_sequenceFocus.js"

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

function cloneFocus(focus: SequenceFocus): SequenceFocus {
  return {
    ...(focus.hoveredOccurrenceId ? { hoveredOccurrenceId: focus.hoveredOccurrenceId } : {}),
    actorIds: [...focus.actorIds],
    groupIds: [...focus.groupIds],
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
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
    for (const label of host.querySelectorAll<HTMLElement>("[data-sequence-actor-label]")) {
      label.dataset.focused = focusedActors.has(label.dataset.sequenceActorId ?? "") ? "true" : "false"
      const worldX = Number(label.dataset.sequenceWorldX)
      const worldY = Number(label.dataset.sequenceWorldY)
      label.style.left = `${clamp(worldX * camera.scale + camera.x, 4, viewport.width - 4)}px`
      label.style.top = `${clamp(worldY * camera.scale + camera.y, 4, viewport.height - 24)}px`
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
    if (input.geometry.renderRevisionId !== input.artifact.renderRevision.id) {
      throw new Error("sequence board geometry render revision does not match artifact")
    }

    const shell = document.createElement("div")
    shell.dataset.sequenceBoard = "true"
    shell.style.cssText = "position:relative;width:100%;height:100%"
    const scene = document.createElement("div")
    scene.dataset.sequenceScene = "true"
    scene.style.cssText = "position:absolute;left:0;top:0;transform-origin:top left"
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

    const actorOverlay = document.createElement("div")
    actorOverlay.dataset.sequenceActorOverlay = "true"
    actorOverlay.style.cssText = "position:absolute;inset:0;pointer-events:none"
    const actors = new Map(
      input.artifact.occurrences.filter(occurrence => occurrence.kind === "actor").map(actor => [actor.id, actor]),
    )
    const labels = new Map(
      input.geometry.entities
        .filter(entity => entity.role === "actor-label")
        .map(entity => [entity.occurrenceId, entity]),
    )
    for (const [actorId, actor] of actors) {
      const entity = labels.get(actorId)
      if (!entity) continue
      const label = document.createElement("span")
      label.dataset.sequenceActorLabel = "true"
      label.dataset.sequenceActorId = actorId
      label.textContent = actor.label ?? actorId
      label.style.cssText = "position:absolute;white-space:nowrap;pointer-events:none"
      label.dataset.sequenceWorldX = String(entity.worldBounds.x - input.geometry.viewBox.x)
      label.dataset.sequenceWorldY = String(entity.worldBounds.y - input.geometry.viewBox.y)
      actorOverlay.append(label)
    }

    const focusOverlay = document.createElement("div")
    focusOverlay.dataset.sequenceFocusOverlay = "true"
    focusOverlay.style.cssText = "position:absolute;right:4px;top:4px;display:flex;gap:4px;pointer-events:none"
    shell.append(scene, actorOverlay, focusOverlay)

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
        actorLabelIds: [...host.querySelectorAll<HTMLElement>("[data-sequence-actor-label]")].map(
          item => item.dataset.sequenceActorId ?? "",
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
