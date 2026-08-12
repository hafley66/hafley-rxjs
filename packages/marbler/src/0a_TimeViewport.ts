export type TimeRange = readonly [startMs: number, endMs: number]

export type TimeViewport = {
  full: TimeRange
  visible: TimeRange
  followLive: boolean
}

export type TimelineMark =
  | { id: string; kind: "dot"; time: number; lane?: number; variant?: "next" | "complete" | "error" | "suppressed"; label?: string }
  | { id: string; kind: "span"; start: number; end: number; lane?: number }
  | { id: string; kind: "link"; from: { time: number; lane: number }; to: { time: number; lane: number } }

export type TimelineGesture =
  | { type: "pan"; deltaPx: number; widthPx: number }
  | { type: "zoom"; anchorPx: number; factor: number; widthPx: number }
  | { type: "brush"; range: TimeRange }
  | { type: "fit" }
  | { type: "follow"; enabled: boolean }
  | { type: "full"; range: TimeRange }

const MIN_SPAN_MS = 1

export function eventRange(events: ReadonlyArray<{ start: number; duration: number }>): TimeRange {
  if (events.length === 0) return [0, 1]
  return events.reduce<TimeRange>((range, event) => [
    Math.min(range[0], event.start),
    Math.max(range[1], event.start + event.duration),
  ], [events[0].start, events[0].start + events[0].duration])
}

export function createTimeViewport(full: TimeRange): TimeViewport {
  return { full, visible: full, followLive: true }
}

function clampRange(range: TimeRange, full: TimeRange): TimeRange {
  const fullSpan = Math.max(MIN_SPAN_MS, full[1] - full[0])
  const span = Math.min(fullSpan, Math.max(MIN_SPAN_MS, range[1] - range[0]))
  const start = Math.min(full[1] - span, Math.max(full[0], range[0]))
  return [start, start + span]
}

export function reduceTimeViewport(state: TimeViewport, gesture: TimelineGesture): TimeViewport {
  if (gesture.type === "fit") return { ...state, visible: state.full, followLive: false }
  if (gesture.type === "follow") return { ...state, followLive: gesture.enabled, visible: gesture.enabled ? [state.full[1] - (state.visible[1] - state.visible[0]), state.full[1]] : state.visible }
  if (gesture.type === "brush") return { ...state, visible: clampRange(gesture.range, state.full), followLive: false }
  if (gesture.type === "full") {
    const visible = state.followLive
      ? clampRange([gesture.range[1] - (state.visible[1] - state.visible[0]), gesture.range[1]], gesture.range)
      : clampRange(state.visible, gesture.range)
    return { ...state, full: gesture.range, visible }
  }
  const span = state.visible[1] - state.visible[0]
  if (gesture.type === "pan") {
    const delta = -(gesture.deltaPx / Math.max(1, gesture.widthPx)) * span
    return { ...state, visible: clampRange([state.visible[0] + delta, state.visible[1] + delta], state.full), followLive: false }
  }
  const anchorFraction = Math.min(1, Math.max(0, gesture.anchorPx / Math.max(1, gesture.widthPx)))
  const anchor = state.visible[0] + anchorFraction * span
  const nextSpan = Math.min(state.full[1] - state.full[0], Math.max(MIN_SPAN_MS, span * gesture.factor))
  return {
    ...state,
    visible: clampRange([anchor - anchorFraction * nextSpan, anchor + (1 - anchorFraction) * nextSpan], state.full),
    followLive: false,
  }
}

export function densityBuckets(marks: readonly TimelineMark[], full: TimeRange, count: number): Uint32Array {
  const buckets = new Uint32Array(Math.max(1, count))
  const span = Math.max(MIN_SPAN_MS, full[1] - full[0])
  marks.forEach((mark) => {
    if (mark.kind === "link") return
    const time = mark.kind === "dot" ? mark.time : mark.start
    const index = Math.min(buckets.length - 1, Math.max(0, Math.floor(((time - full[0]) / span) * buckets.length)))
    buckets[index]++
  })
  return buckets
}
