// The first producer: a document written by hand, with no columns to count and no `-` to align.
//
// An author says which turn an event is on and how much time it cost, never where it sits on a line:
//
//   marbleDoc({ lanes: [{ id: "keys", events: [
//     { tick: 1, value: "k" },
//     { after: 2, value: "k" },
//     { after: 1, ms: 300, value: "k" },
//     { kind: "complete" },
//   ]}]})
//
// Columns are the document's clock, so `ms` anywhere advances the time every lane shares.
import { z } from "zod"
import {
  LaneIdSchema,
  MARBLES_VERSION,
  type MarbleBirth,
  type MarbleDoc,
  type MarbleKind,
  MarbleKindSchema,
  type MarbleLane,
  marbleEventId,
  normalizeMarbleDoc,
} from "./0_types.js"

export const DEFAULT_MS_PER_TICK = 1

export const MarbleEventInputSchema = z
  .object({
    /** Absolute column. */
    tick: z.number().int().min(0).optional(),
    /** Columns after the previous event on this lane. Defaults to 1. */
    after: z.number().int().min(1).optional(),
    /** Virtual milliseconds this event costs, as a gap since the previous column. */
    ms: z.number().int().min(0).optional(),
    /** Absolute milliseconds, for importing a runner-shaped document by hand. */
    frame: z.number().int().min(0).optional(),
    kind: MarbleKindSchema.optional(),
    value: z.string().optional(),
    /** Why it happened. */
    note: z.string().optional(),
    /** The event that produced this one. */
    from: z.string().optional(),
  })
  .strict()

export const MarbleBirthInputSchema = z
  .object({
    tick: z.number().int().min(0),
    from: z.string().optional(),
    cause: z.string().optional(),
    seed: z.string().optional(),
    note: z.string().optional(),
  })
  .strict()

export const MarbleLaneInputSchema = z
  .object({
    id: LaneIdSchema,
    label: z.string().optional(),
    parent: z.string().optional(),
    born: MarbleBirthInputSchema.optional(),
    events: z.array(MarbleEventInputSchema),
  })
  .strict()

export const MarbleDocInputSchema = z
  .object({
    title: z.string().optional(),
    /** Virtual milliseconds one column costs when an event does not say otherwise. */
    msPerTick: z.number().int().min(0).optional(),
    lanes: z.array(MarbleLaneInputSchema).min(1),
  })
  .strict()

export type MarbleEventInput = z.input<typeof MarbleEventInputSchema>
export type MarbleLaneInput = z.input<typeof MarbleLaneInputSchema>
export type MarbleDocInput = z.input<typeof MarbleDocInputSchema>

export class MarbleDocumentError extends Error {
  override name = "MarbleDocumentError"
}

/**
 * Build a document from an authored one. Every field is validated, every lane id and every `from`
 * resolves, and the column clock is filled in from the events that declared time.
 */
export function marbleDoc(input: MarbleDocInput): MarbleDoc {
  const parsed = MarbleDocInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new MarbleDocumentError(
      `marbleDoc: ${parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
    )
  }
  const value = parsed.data
  const msPerTick = value.msPerTick ?? DEFAULT_MS_PER_TICK

  const seenLanes = new Set<string>()
  const lanes: MarbleLane[] = value.lanes.map(lane => {
    if (seenLanes.has(lane.id)) throw new MarbleDocumentError(`marbleDoc: lanes.${lane.id}: duplicate lane id`)
    seenLanes.add(lane.id)
    return {
      id: lane.id,
      label: lane.label ?? lane.id,
      parent: lane.parent ?? null,
      born: lane.born === undefined ? null : birthOf(lane.born),
      notifications: [],
    }
  })
  const laneById = new Map(lanes.map(lane => [lane.id, lane]))

  // Assign ticks with a forward-only cursor, then check it never went backwards.
  const ticks: number[][] = []
  value.lanes.forEach((inputLane, laneIndex) => {
    let cursor = 0
    const laneTicks: number[] = []
    inputLane.events.forEach((event, eventIndex) => {
      const tick = event.tick ?? cursor + (event.after ?? 1)
      if (tick < cursor) {
        throw new MarbleDocumentError(
          `marbleDoc: lanes.${inputLane.id}.events.${eventIndex}.tick: ${tick} is before the previous event on this lane (${cursor})`,
        )
      }
      laneTicks.push(tick)
      cursor = tick
    })
    ticks[laneIndex] = laneTicks
  })

  // The column clock: an absolute `frame` pins a column, a `ms` gap advances it, otherwise msPerTick.
  const lastTick = ticks.reduce((highest, laneTicks) => laneTicks.reduce((inner, t) => Math.max(inner, t), highest), 0)
  const pinned = new Map<number, number>()
  const gaps = new Map<number, number>()
  value.lanes.forEach((lane, laneIndex) => {
    lane.events.forEach((event, eventIndex) => {
      const tick = ticks[laneIndex]?.[eventIndex] ?? 0
      if (event.frame !== undefined) {
        const existing = pinned.get(tick)
        if (existing !== undefined && existing !== event.frame) {
          throw new MarbleDocumentError(
            `marbleDoc: column ${tick} is pinned to both ${existing}ms and ${event.frame}ms (lanes.${lane.id}.events.${eventIndex}.frame)`,
          )
        }
        pinned.set(tick, event.frame)
      }
      if (event.ms !== undefined) gaps.set(tick, Math.max(gaps.get(tick) ?? 0, event.ms))
    })
  })

  const columns: number[] = [pinned.get(0) ?? 0]
  for (let tick = 1; tick <= lastTick; tick += 1) {
    const previous = columns[tick - 1] ?? 0
    const frame = pinned.get(tick) ?? previous + (gaps.get(tick) ?? msPerTick)
    if (frame < previous) {
      throw new MarbleDocumentError(
        `marbleDoc: column ${tick} is at ${frame}ms, before column ${tick - 1} at ${previous}ms`,
      )
    }
    columns.push(frame)
  }

  value.lanes.forEach((inputLane, laneIndex) => {
    const lane = laneById.get(inputLane.id)
    if (!lane) return
    inputLane.events.forEach((event, eventIndex) => {
      const id = marbleEventId(lane.id, eventIndex)
      const kind: MarbleKind = event.kind ?? "next"
      lane.notifications.push({
        id,
        kind,
        tick: ticks[laneIndex]?.[eventIndex] ?? 0,
        ...(event.value === undefined ? {} : { value: event.value }),
        ...(event.note === undefined ? {} : { note: event.note }),
        ...(event.from === undefined ? {} : { from: event.from }),
      })
    })
  })

  const doc: MarbleDoc = {
    version: MARBLES_VERSION,
    ...(value.title === undefined ? {} : { title: value.title }),
    columns,
    lanes,
  }

  // Every edge must point at something that exists: a typo in a `from` is a typo in the argument.
  const ids = new Set(doc.lanes.flatMap(lane => lane.notifications.map(notification => notification.id)))
  for (const lane of doc.lanes) {
    if (lane.born?.from && !ids.has(lane.born.from)) {
      throw new MarbleDocumentError(
        `marbleDoc: lanes.${lane.id}.born.from: ${lane.born.from} is not an event in this document`,
      )
    }
    for (const notification of lane.notifications) {
      if (notification.from && !ids.has(notification.from)) {
        throw new MarbleDocumentError(
          `marbleDoc: lanes.${lane.id}.events.${Number(notification.id.split("#")[1]) - 1}.from: ${notification.from} is not an event in this document`,
        )
      }
    }
    const parent = lane.parent
    if (parent !== null && !laneById.has(parent)) {
      throw new MarbleDocumentError(`marbleDoc: lanes.${lane.id}.parent: ${parent} is not a lane in this document`)
    }
  }

  return normalizeMarbleDoc(doc)
}

function birthOf(input: { tick: number; from?: string; cause?: string; seed?: string; note?: string }): MarbleBirth {
  return {
    tick: input.tick,
    from: input.from ?? null,
    ...(input.cause === undefined ? {} : { cause: input.cause }),
    ...(input.seed === undefined ? {} : { seed: input.seed }),
    ...(input.note === undefined ? {} : { note: input.note }),
  }
}
