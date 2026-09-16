// The marble document: one serializable value that both producers (the notation reader and the
// virtual-clock runner) emit and every surface consumes. It is the compatibility record — a
// diagram is these bytes plus a reveal point, and nothing else.
//
// Two numbers, and neither is the whole truth:
//
//   tick    the causal column: one turn of the scheduler, or one column an author wrote
//   frame   the virtual milliseconds that column sits at
//
// Two columns share a frame whenever something ran synchronously or on a microtask, and that
// equality is the information. Frames belong to columns, not to events — two events in one column
// are at the same moment by construction, so the document stores the time once per column.
import { z } from "zod"

export const MARBLES_VERSION = "marbles/2" as const

/** The six things that can be on a lane. `truncate` is a harness window closing, not a cancellation. */
export const MarbleKindSchema = z.enum(["next", "error", "complete", "subscribe", "unsubscribe", "truncate"])

/**
 * A lane id is a machine name and an event id is `lane#n`. Keeping `#` out of lane ids is what makes
 * an event id splittable from its lane without a lookup.
 */
export const LaneIdSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "a lane id is [A-Za-z][A-Za-z0-9_-]*")

export const MarbleNotificationSchema = z.object({
  /** `laneId#n`, 1-based in production order. The thing `from` points at. */
  id: z.string().min(1),
  kind: MarbleKindSchema,
  /** The causal column. `columns[tick]` is the virtual milliseconds at that column. */
  tick: z.number().int().min(0),
  /** Display text for a `next` or an `error`. Absent for every other kind. */
  value: z.string().optional(),
  /** Why it happened: written by hand, or by the runner for a fate it observed. */
  note: z.string().optional(),
  /** The event that produced this one — an inner's value on the merged lane, a routed group value. */
  from: z.string().optional(),
  /**
   * The whole-document production index. Lanes are arrays, so two notifications on two lanes at one
   * column have no order between them; the run that produced them does, and this is it. Absent on a
   * hand-written document, where the lane order stands in for it.
   */
  seq: z.number().int().min(0).optional(),
})

/**
 * How a lane began. A declared lane has none: it was subscribed before the run started. An inner
 * lane has the column its subscription began on, and the event that caused it.
 */
export const MarbleBirthSchema = z.object({
  tick: z.number().int().min(0),
  /** The event id that caused this subscription. */
  from: z.string().nullable(),
  /** What the subscription was for: the outer value, a group key. */
  cause: z.string().optional(),
  /** `mergeScan`/`switchScan`: the accumulator this inner was handed. */
  seed: z.string().optional(),
  note: z.string().optional(),
})

export const MarbleLaneSchema = z.object({
  id: LaneIdSchema,
  /** The human name. `inner1` is the machine name, `inner #1` is the label. */
  label: z.string(),
  /** The lane this one arrives through, or null for a source. Drawn as indentation, never stored as depth. */
  parent: z.string().nullable(),
  born: MarbleBirthSchema.nullable(),
  notifications: z.array(MarbleNotificationSchema),
})

export const MarbleDocSchema = z.object({
  version: z.literal(MARBLES_VERSION),
  title: z.string().optional(),
  /** Every causal column in order, in virtual milliseconds. Its length is the column count. */
  columns: z.array(z.number().int().min(0)).min(1),
  lanes: z.array(MarbleLaneSchema),
})

export type MarbleKind = z.infer<typeof MarbleKindSchema>
export type MarbleNotification = z.infer<typeof MarbleNotificationSchema>
export type MarbleBirth = z.infer<typeof MarbleBirthSchema>
export type MarbleLane = z.infer<typeof MarbleLaneSchema>
export type MarbleDoc = z.infer<typeof MarbleDocSchema>

/** A terminal ends the lane; a marker opens or closes the window during which it was listened to. */
export const TERMINAL_KINDS: readonly MarbleKind[] = ["error", "complete", "truncate"]
export const MARKER_KINDS: readonly MarbleKind[] = ["subscribe", "unsubscribe"]

/** `keys#2` — the event id of the nth notification on a lane, 1-based in production order. */
export function marbleEventId(laneId: string, index: number): string {
  return `${laneId}#${index + 1}`
}

/** The lane an event id belongs to, without a lookup. */
export function laneIdOfEvent(eventId: string): string {
  const at = eventId.lastIndexOf("#")
  return at === -1 ? eventId : eventId.slice(0, at)
}

/** The column count: one per causal turn, which is what the axis draws. */
export function marbleColumnCount(doc: MarbleDoc): number {
  return doc.columns.length
}

/** The virtual milliseconds at a column, clamped to the document. */
export function frameAtTick(doc: MarbleDoc, tick: number): number {
  if (doc.columns.length === 0) return 0
  const index = Math.min(Math.max(Math.trunc(tick), 0), doc.columns.length - 1)
  return doc.columns[index] ?? 0
}

/** The last column's virtual milliseconds: the document's extent in time. */
export function docExtent(doc: MarbleDoc): number {
  return doc.columns.length === 0 ? 0 : (doc.columns[doc.columns.length - 1] ?? 0)
}

/** The column after this lane's last notification; 0 for a lane with nothing on it. */
export function laneExtent(lane: MarbleLane): number {
  let last = -1
  for (const notification of lane.notifications) if (notification.tick > last) last = notification.tick
  return last + 1
}

/** Where an event sits, if the document has it. */
export type MarbleLocation = { lane: MarbleLane; notification: MarbleNotification; index: number }

/**
 * One notification as the document orders it, with what is known about who caused it.
 *
 * `order` is the call index within its column: 0 is the entry the run made first. That is the
 * well-order the lanes cannot carry — they are arrays, so a column's events have an order only in
 * `seq`, and only a run can write `seq`. `cause` is the by-whom: the event a producer pointed `from`
 * at, or the birth of a lane this entry started.
 */
export type MarbleEntry = {
  lane: MarbleLane
  notification: MarbleNotification
  cause: string | null
  order: number
}

/**
 * Everything on one column, in the order it happened rather than the order the lanes are declared.
 *
 * A hand-written document has no `seq`, so lane order stands in for it — which is what a document
 * whose lanes were declared in the order they were subscribed already means.
 */
export function marbleEntries(doc: MarbleDoc, tick: number): MarbleEntry[] {
  const ordered: Array<{ lane: MarbleLane; notification: MarbleNotification; cause: string | null; laneIndex: number; index: number; seq: number }> = []
  doc.lanes.forEach((lane, laneIndex) => {
    lane.notifications.forEach((notification, index) => {
      if (notification.tick !== tick) return
      // A lane's first notification on its birth column is the lane entering a state, and the birth
      // says who entered it: the event the operator was handling when it subscribed the inner.
      const startsLane = index === 0 && lane.born?.tick === tick
      ordered.push({
        lane,
        notification,
        cause: notification.from ?? (startsLane ? lane.born?.from ?? null : null),
        laneIndex,
        index,
        seq: notification.seq ?? Number.MAX_SAFE_INTEGER,
      })
    })
  })
  ordered.sort(
    (left, right) =>
      left.seq - right.seq || left.laneIndex - right.laneIndex || left.index - right.index,
  )
  return ordered.map((row, order) => ({
    lane: row.lane,
    notification: row.notification,
    cause: row.cause,
    order,
  }))
}

/**
 * One call: a lane entered a state on a column and stayed in it until something ended it.
 *
 * A call opens at the lane's first event — a `subscribe` where the producer recorded one, and the
 * lane's first event where it did not, because a hand-written lane may simply start. It closes at
 * the first `unsubscribe` or terminal. A lane subscribed again after that has two calls, so a pair
 * counts calls rather than lanes: one lane is one row, and `to: null` is a call still running.
 */
export type MarbleCallSpan = {
  lane: MarbleLane
  /** The column the call was entered on. */
  from: number
  /** The column it ended on, null while it is still running. */
  to: number | null
  opened: MarbleNotification
  closed: MarbleNotification | null
}

export function marbleCallSpans(doc: MarbleDoc): MarbleCallSpan[] {
  const spans: MarbleCallSpan[] = []
  const ends = (kind: MarbleKind): boolean => kind === "unsubscribe" || TERMINAL_KINDS.includes(kind)
  for (const lane of doc.lanes) {
    let opened: MarbleNotification | null = null
    for (const notification of lane.notifications) {
      if (opened === null) {
        opened = notification
        // A lane that ends on its first event never had a call to span: it is one event wide.
        if (ends(notification.kind)) {
          spans.push({ lane, from: notification.tick, to: notification.tick, opened: notification, closed: notification })
          opened = null
        }
        continue
      }
      if (ends(notification.kind)) {
        spans.push({ lane, from: opened.tick, to: notification.tick, opened, closed: notification })
        opened = null
      }
    }
    if (opened !== null) spans.push({ lane, from: opened.tick, to: null, opened, closed: null })
  }
  return spans
}

export function findMarble(doc: MarbleDoc, eventId: string): MarbleLocation | null {
  for (const lane of doc.lanes) {
    const index = lane.notifications.findIndex(notification => notification.id === eventId)
    const notification = index === -1 ? undefined : lane.notifications[index]
    if (notification) return { lane, notification, index }
  }
  return null
}

/**
 * Order is the only thing normalization decides. Notifications sort by tick with ties kept in the
 * order they were produced — that order is the wire order, and `(ab)` means a then b. A tick past
 * the stored columns is recovered rather than rejected: a producer that counted a turn the columns
 * did not is off by a column, and the document keeps its content.
 */
export function normalizeMarbleDoc(doc: MarbleDoc): MarbleDoc {
  const lanes = doc.lanes.map(lane => ({
    ...lane,
    notifications: [...lane.notifications].sort((a, b) => a.tick - b.tick),
  }))
  const needed = lanes.reduce(
    (highest, lane) => lane.notifications.reduce((inner, n) => Math.max(inner, n.tick), highest),
    0,
  )
  const columns = [...doc.columns]
  while (columns.length <= needed) columns.push(columns[columns.length - 1] ?? 0)
  return { ...doc, columns, lanes }
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
export function describeNotification(notification: MarbleNotification, doc: MarbleDoc): string {
  const frame = frameAtTick(doc, notification.tick)
  const at = `at tick ${notification.tick} (${frame}ms)`
  switch (notification.kind) {
    case "next":
      return `${notification.value ?? "value"} ${at}`
    case "error":
      return `error ${notification.value ?? ""} ${at}`.replace("  ", " ")
    case "complete":
      return `complete ${at}`
    case "subscribe":
      return `subscribed ${at}`
    case "unsubscribe":
      return `unsubscribed ${at}`
    case "truncate":
      return `window closed ${at}`
  }
}

/** The one-line text form of a lane, which is also what a screen reader gets. */
export function describeLane(lane: MarbleLane, doc: MarbleDoc): string {
  const parts = lane.notifications.map(notification => describeNotification(notification, doc))
  const born = lane.born ? ` (born at tick ${lane.born.tick}${lane.born.from ? ` from ${lane.born.from}` : ""})` : ""
  return `${lane.label}${born}: ${parts.length ? parts.join(", ") : "nothing"}`
}

export function describeMarbleDoc(doc: MarbleDoc): string {
  const lanes = doc.lanes.map(lane => describeLane(lane, doc)).join("; ")
  const columns = marbleColumnCount(doc)
  return `${doc.title ? `${doc.title}. ` : ""}${doc.lanes.length} lane${
    doc.lanes.length === 1 ? "" : "s"
  } over ${columns} column${columns === 1 ? "" : "s"}. ${lanes}`
}

/**
 * Every stretch during which the lane was being listened to, in tick order. Empty means the lane
 * carries no markers, so it was listened to throughout.
 */
export function listeningWindows(lane: MarbleLane): Array<{ from: number; to: number }> {
  const windows: Array<{ from: number; to: number }> = []
  let open: number | null = null
  for (const notification of lane.notifications) {
    if (notification.kind === "subscribe" && open === null) open = notification.tick
    // An unsubscribe with no subscription before it was listening from the start of the diagram.
    if (notification.kind === "unsubscribe" || notification.kind === "truncate") {
      windows.push({ from: open ?? 0, to: notification.tick })
      open = null
    }
  }
  if (open !== null) windows.push({ from: open, to: Number.POSITIVE_INFINITY })
  return windows
}

/** An event that caused another, or a subscription. `to` is an event id, or a lane id for a birth. */
export type MarbleEdge = { from: string; to: string; kind: "value" | "born"; label: string }

/**
 * Every edge the document states: value routing (a `from` on a notification) and subscription
 * (a `from` on a birth). Nothing is inferred here — an edge exists because a producer recorded the
 * event that caused it.
 */
export function marbleEdges(doc: MarbleDoc): MarbleEdge[] {
  const edges: MarbleEdge[] = []
  for (const lane of doc.lanes) {
    if (lane.born?.from) edges.push({ from: lane.born.from, to: lane.id, kind: "born", label: lane.label })
    for (const notification of lane.notifications) {
      if (notification.from)
        edges.push({ from: notification.from, to: notification.id, kind: "value", label: lane.label })
    }
  }
  return edges
}

/** Every edge reachable backwards from an event, following `from` — the chain, not the neighbourhood. */
export function marbleChain(doc: MarbleDoc, eventId: string): string[] {
  const chain: string[] = []
  const seen = new Set<string>()
  let cursor: string | null = eventId
  while (cursor !== null && !seen.has(cursor)) {
    seen.add(cursor)
    chain.unshift(cursor)
    cursor = findMarble(doc, cursor)?.notification.from ?? null
    if (cursor === null) {
      const lane = doc.lanes.find(it => it.id === laneIdOfEvent(seen.values().next().value ?? ""))
      cursor = lane?.born?.from ?? null
      if (cursor !== null) seen.add(cursor)
    }
  }
  return chain
}

/** One causal column on the axis, with the pixel position the geometry gave it. */
export type MarbleAxisColumn = {
  tick: number
  /** Virtual milliseconds at this column. */
  frame: number
  /** Left edge, in pixels from the start of the strip. */
  x: number
  /** Distance from the previous column; null for the first. */
  pitch: number | null
  /** Milliseconds the axis refused to draw here, when the gap exceeded the cap. */
  compressedMs: number | null
  /** How many events are on this column. */
  events: number
}

export type MarbleAxis = {
  columns: MarbleAxisColumn[]
  /** The smallest positive gap between consecutive columns; 1 when there is no positive gap. */
  unitMs: number
  /** The strip width: the last column's x plus one pitch. */
  width: number
}

export const AXIS_PITCH = 26
/** Six columns of pitch. Past this the axis breaks and carries the real milliseconds instead. */
export const AXIS_MAX_PITCH = AXIS_PITCH * 6
/** Room at both ends of a strip, so a marble on the first or last column is not half off it. */
export const AXIS_PAD = 16

/**
 * The axis honours time up to a threshold: every turn gets its own column, and the width between
 * two columns is proportional to the time between them up to a cap. Past the cap the axis breaks.
 */
export function marbleAxis(doc: MarbleDoc, options: { pitch?: number; maxPitch?: number } = {}): MarbleAxis {
  const pitch = options.pitch ?? AXIS_PITCH
  const maxPitch = options.maxPitch ?? AXIS_MAX_PITCH
  const frames = doc.columns

  let unitMs = Number.POSITIVE_INFINITY
  for (let index = 1; index < frames.length; index += 1) {
    const gap = (frames[index] ?? 0) - (frames[index - 1] ?? 0)
    if (gap > 0) unitMs = Math.min(unitMs, gap)
  }
  if (!Number.isFinite(unitMs) || unitMs <= 0) unitMs = 1

  const counts = new Map<number, number>()
  for (const lane of doc.lanes) {
    for (const notification of lane.notifications) {
      counts.set(notification.tick, (counts.get(notification.tick) ?? 0) + 1)
    }
  }

  const columns: MarbleAxisColumn[] = []
  let x = 0
  for (let tick = 0; tick < frames.length; tick += 1) {
    const frame = frames[tick] ?? 0
    const previous = tick === 0 ? null : (frames[tick - 1] ?? 0)
    const gap = previous === null ? 0 : frame - previous
    const scaled = previous === null ? pitch : Math.max(pitch, Math.min(maxPitch, (gap / unitMs) * pitch))
    const compressed = previous !== null && scaled >= maxPitch && gap > unitMs ? gap : null
    if (tick > 0) x += scaled
    columns.push({
      tick,
      frame,
      x,
      pitch: previous === null ? null : scaled,
      compressedMs: compressed,
      events: counts.get(tick) ?? 0,
    })
  }

  return { columns, unitMs, width: x + pitch }
}

/**
 * The column tracks, as CSS grid track widths: the pad, one track per gap between columns, and the
 * room past the last column. Column `tick` therefore starts at grid line `tick + 2`, so a surface
 * that lays its axis and its lane strips out over this one list cannot put a marble off its column:
 * the alignment is the track list, not arithmetic done twice.
 *
 * The tracks sum to `width + 2 * pad` — the same strip the pixels used to be computed for.
 */
export function marbleTracks(axis: MarbleAxis, options: { pad?: number } = {}): number[] {
  const pad = options.pad ?? AXIS_PAD
  const last = axis.columns[axis.columns.length - 1]
  // `width` already reserves one pitch past the last column; that slack is the trailing track.
  const trailing = axis.width - (last?.x ?? 0)
  return [pad, ...axis.columns.slice(1).map(column => column.pitch ?? 0), trailing + pad]
}
