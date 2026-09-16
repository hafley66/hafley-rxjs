// The marble document: one serializable value that both producers (the notation reader and the
// virtual-clock runner) emit and every surface consumes. It is the compatibility record — a
// diagram is these bytes plus a playhead, and nothing else.
import { z } from "zod"

export const MARBLES_VERSION = "marbles/1" as const

// `subscribe`/`unsubscribe` are markers, not notifications: they say when the lane was being
// listened to, which is what makes a hot lane or a cancelled inner observable legible.
export const MarbleKindSchema = z.enum(["next", "error", "complete", "subscribe", "unsubscribe"])

export const MarbleNotificationSchema = z.object({
  kind: MarbleKindSchema,
  /** Integer frame on the document's one clock. The runner's frame is virtual milliseconds. */
  frame: z.number().int().min(0),
  /** Display text for a `next` or an `error`. Absent for every other kind. */
  value: z.string().optional(),
})

export const MarbleLaneSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  /** The lane this one arrives through, or null for a source. Drawn as indentation, never stored as depth. */
  parent: z.string().nullable(),
  notifications: z.array(MarbleNotificationSchema),
})

export const MarbleDocSchema = z.object({
  version: z.literal(MARBLES_VERSION),
  title: z.string().optional(),
  /** The diagram's extent. Normalization only ever raises it, so it holds the content and can pad it. */
  frames: z.number().int().min(1),
  lanes: z.array(MarbleLaneSchema),
})

export type MarbleKind = z.infer<typeof MarbleKindSchema>
export type MarbleNotification = z.infer<typeof MarbleNotificationSchema>
export type MarbleLane = z.infer<typeof MarbleLaneSchema>
export type MarbleDoc = z.infer<typeof MarbleDocSchema>

/** The frame after this lane's last notification; 0 for a lane with nothing on it. */
export function laneExtent(lane: MarbleLane): number {
  let last = -1
  for (const notification of lane.notifications) if (notification.frame > last) last = notification.frame
  return last + 1
}

export function docExtent(doc: MarbleDoc): number {
  let extent = 1
  for (const lane of doc.lanes) extent = Math.max(extent, laneExtent(lane))
  return extent
}

/**
 * Order is the only thing normalization decides. Notifications sort by frame with ties kept in the
 * order they were produced — that order is the wire order, and `(ab)` means a then b.
 */
export function normalizeMarbleDoc(doc: MarbleDoc): MarbleDoc {
  const lanes = doc.lanes.map(lane => ({
    ...lane,
    notifications: [...lane.notifications].sort((a, b) => a.frame - b.frame),
  }))
  return { ...doc, frames: Math.max(doc.frames, docExtent({ ...doc, lanes })), lanes }
}

/** How far this lane sits from a root, following `parent`. A cycle or a missing parent stops at 0. */
export function laneDepth(lane: MarbleLane, lanes: readonly MarbleLane[]): number {
  const byId = new Map(lanes.map(it => [it.id, it]))
  const seen = new Set<string>([lane.id])
  let depth = 0
  let cursor = lane.parent
  while (cursor !== null && !seen.has(cursor)) {
    seen.add(cursor)
    const next = byId.get(cursor)
    if (!next) break
    depth += 1
    cursor = next.parent
  }
  return depth
}

/** One notification in words. Exhaustive over the kind union, so a new kind is a compile error. */
export function describeNotification(notification: MarbleNotification): string {
  switch (notification.kind) {
    case "next":
      return `${notification.value ?? "value"} at ${notification.frame}`
    case "error":
      return `error ${notification.value ?? ""} at ${notification.frame}`.trim()
    case "complete":
      return `complete at ${notification.frame}`
    case "subscribe":
      return `subscribed at ${notification.frame}`
    case "unsubscribe":
      return `unsubscribed at ${notification.frame}`
  }
}

/** The one-line text form of a lane, which is also what a screen reader gets. */
export function describeLane(lane: MarbleLane): string {
  const parts = lane.notifications.map(describeNotification)
  return `${lane.label}: ${parts.length ? parts.join(", ") : "nothing"}`
}

export function describeMarbleDoc(doc: MarbleDoc): string {
  const lanes = doc.lanes.map(describeLane).join("; ")
  return `${doc.title ? `${doc.title}. ` : ""}${doc.lanes.length} lane${doc.lanes.length === 1 ? "" : "s"} over ${doc.frames} frames. ${lanes}`
}

/**
 * Every stretch during which the lane was being listened to, in frame order. Empty means the lane
 * carries no markers, so it was listened to throughout.
 */
export function listeningWindows(lane: MarbleLane): Array<{ from: number; to: number }> {
  const windows: Array<{ from: number; to: number }> = []
  let open: number | null = null
  for (const notification of lane.notifications) {
    if (notification.kind === "subscribe" && open === null) open = notification.frame
    // An unsubscribe with no subscription before it was listening from the start of the diagram.
    if (notification.kind === "unsubscribe") {
      windows.push({ from: open ?? 0, to: notification.frame })
      open = null
    }
  }
  if (open !== null) windows.push({ from: open, to: Number.POSITIVE_INFINITY })
  return windows
}
