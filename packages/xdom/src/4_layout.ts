// One resize utility for every draggable track (nav width, overview height, details height).
// CSS owns the proportions via `--track-<name>` custom properties on `root`; this only persists the pixel value.
import { merge, tap, type Observable } from "rxjs"
import { Signal, storageSignal, type Signal as SignalType, type Storage } from "@hafley66/signals"
import type { SizingStore } from "./3_sizing.js"

export type Track = { name: string; min: number; max: number; fallback: number; axis: "x" | "y" }

function clampToTrack(track: Track, value: number | undefined): number {
  const raw = value ?? track.fallback
  return Math.min(track.max, Math.max(track.min, raw))
}

function viewportPxForAxis(axis: Track["axis"]): number {
  return axis === "x" ? window.innerWidth : window.innerHeight
}

// A write is "manual" only when gutter marks the signal right before making it; anything else
// (initial mount, a programmatic `.$(value)` from elsewhere) defaults to false.
const manualWrites = new WeakMap<SignalType<number>, true>()

function takeManual(signal: SignalType<number>): boolean {
  const manual = manualWrites.get(signal) ?? false
  manualWrites.delete(signal)
  return manual
}

function markManual(signal: SignalType<number>): void {
  manualWrites.set(signal, true)
}

// Recompute an axis's starting pixels with sizing.restore when a track's last recorded viewport differs.
function startingPx(tracks: Track[], stored: Record<string, number>, sizing?: SizingStore): Record<string, number> {
  if (!sizing) return stored
  const result = { ...stored }
  for (const axis of ["x", "y"] as const) {
    const axisTracks = tracks.filter(track => track.axis === axis)
    if (axisTracks.length === 0) continue
    const viewportPx = viewportPxForAxis(axis)
    const records = sizing.state.$()
    const changed = axisTracks.some(track => {
      const record = records[track.name]
      return record !== undefined && record.viewportPx !== viewportPx
    })
    if (!changed) continue
    const ids = axisTracks.map(track => track.name)
    const mins = Object.fromEntries(axisTracks.map(track => [track.name, track.min]))
    Object.assign(result, sizing.restore(ids, viewportPx, mins))
  }
  return result
}

// One Signal<number> per track, persisted as one JSON blob through `storage`, with `run$` carrying
// the writes to whatever stream the caller already mounts. `sizing` records and seeds them.
export type Layout = { tracks: Record<string, SignalType<number>>; run$: Observable<unknown> }

export function layout(root: HTMLElement, tracks: Track[], storage: Storage<string>, sizing?: SizingStore): Layout {
  const defaults = Object.fromEntries(tracks.map(track => [track.name, track.fallback]))
  const stored = storageSignal<Record<string, number>>(storage, defaults)
  const starting = startingPx(tracks, stored.$(), sizing)
  const signals: Record<string, SignalType<number>> = {}
  const writes: Observable<unknown>[] = []

  for (const track of tracks) {
    const value = clampToTrack(track, starting[track.name])
    const signal = Signal<number>(value)
    // The first paint cannot wait for a subscriber: the var has to be there before layout runs.
    root.style.setProperty(`--track-${track.name}`, `${value}px`)
    writes.push(
      signal.$.pipe(
        tap(next => {
          const clamped = clampToTrack(track, next)
          root.style.setProperty(`--track-${track.name}`, `${clamped}px`)
          stored.$({ ...stored.$(), [track.name]: clamped })
          sizing?.record(track.name, clamped, viewportPxForAxis(track.axis), takeManual(signal))
        }),
      ),
    )
    signals[track.name] = signal
  }
  return { tracks: signals, run$: merge(...writes) }
}

// `invert`: the track grows when the pointer moves toward the origin (a panel hung off the right or bottom edge).
export type GutterOptions = { commit?: "frame" | "release"; axis?: "x" | "y"; invert?: boolean }

// Pointer drag with setPointerCapture. 'release' (default): a transform on `el` moves during the
// drag, the track signal writes once on pointerup; 'frame' writes the signal every frame instead.
export function gutter(el: HTMLElement, track: SignalType<number>, options: GutterOptions = {}): () => void {
  const commit = options.commit ?? "release"
  const axis = options.axis ?? "x"
  const sign = options.invert ? -1 : 1
  let dragging = false
  let startPoint = 0
  let startValue = 0
  const pointOf = (event: PointerEvent) => (axis === "x" ? event.clientX : event.clientY)

  const onPointerDown = (event: PointerEvent) => {
    dragging = true
    startPoint = pointOf(event)
    startValue = track.$()
    el.setPointerCapture(event.pointerId)
    el.classList.add("dragging")
  }
  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return
    const delta = pointOf(event) - startPoint
    if (commit === "frame") {
      markManual(track)
      track.$(startValue + sign * delta)
    } else {
      el.style.transform = axis === "x" ? `translateX(${delta}px)` : `translateY(${delta}px)`
    }
  }
  const onPointerUp = (event: PointerEvent) => {
    if (!dragging) return
    dragging = false
    el.releasePointerCapture(event.pointerId)
    el.classList.remove("dragging")
    if (commit === "release") {
      markManual(track)
      track.$(startValue + sign * (pointOf(event) - startPoint))
      el.style.transform = ""
    }
  }

  el.addEventListener("pointerdown", onPointerDown)
  el.addEventListener("pointermove", onPointerMove)
  el.addEventListener("pointerup", onPointerUp)
  function unsubscribe(): void {
    el.removeEventListener("pointerdown", onPointerDown)
    el.removeEventListener("pointermove", onPointerMove)
    el.removeEventListener("pointerup", onPointerUp)
  }
  return unsubscribe
}
