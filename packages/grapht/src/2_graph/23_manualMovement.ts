import type { GraphFrame } from "./0_frame.js"
import { translateGraphGeometry, type GraphTranslations } from "./5_translateGeometry.js"

/** Deltas are world units from the start of one gesture. One commit becomes one undo entry. */
export type GraphMove = { id: string; dx: number; dy: number; phase?: "preview" | "commit" | "cancel" }
export type MoveHistory = { events: GraphMove[]; cursor: number }

/** Fold the retained event prefix and the current preview without mutating either. */
export function movementOffsets(frame: GraphFrame, history: MoveHistory, preview?: GraphMove): GraphTranslations {
  const offsets: Record<string, { x: number; y: number }> = {}
  for (const move of [...history.events.slice(0, history.cursor), ...(preview ? [preview] : [])]) {
    const item = frame.graph[move.id]
    if (!item || !Number.isFinite(move.dx) || !Number.isFinite(move.dy)) continue
    const lane = frame.geometry.columnBoundsById?.[move.id]
    const message = item.type === "edge" && (item.data as { kind?: string } | undefined)?.kind === "message"
    const previous = offsets[move.id] ?? { x: 0, y: 0 }
    offsets[move.id] = { x: previous.x + (message ? 0 : move.dx), y: previous.y + (lane ? 0 : move.dy) }
  }
  return offsets
}

/** Sequence actor moves translate the lane, with attached message routes stretched between
 * their actor offsets. Message moves shift the row along those lanes. General edge moves
 * shift interior route points while retaining endpoint anchors.
 */
export function moveGraphFrame(frame: GraphFrame, translations: GraphTranslations, editable: boolean): GraphFrame {
  const translated = translateGraphGeometry(frame.graph, frame.geometry, translations)
  const routesById = { ...translated.routesById }
  for (const item of Object.values(frame.graph)) {
    if (item.type !== "edge") continue
    const original = frame.geometry.routesById[item.id]
    if (!original || original.length < 4) continue
    const from = translations[item.fromId] ?? { x: 0, y: 0 }
    const to = translations[item.toId] ?? { x: 0, y: 0 }
    const own = translations[item.id] ?? { x: 0, y: 0 }
    const sequence = (item.data as { kind?: string } | undefined)?.kind === "message"
    routesById[item.id] = Float32Array.from(original, (value, index) => {
      const t = Math.floor(index / 2) / (original.length / 2 - 1)
      const axis = index % 2 ? "y" : "x"
      return value + from[axis] * (1 - t) + to[axis] * t + own[axis] * (sequence ? 1 : Math.sin(Math.PI * t))
    })
  }
  return { ...frame, geometry: { ...translated, routesById }, presentation: { ...frame.presentation, translationsById: translations, editable } }
}
