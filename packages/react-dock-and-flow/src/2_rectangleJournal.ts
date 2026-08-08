import { Signal, type Signal$, SignalCreator } from "@hafley66/signals"
import { map, scan } from "rxjs"

export type RectangleContent =
  | { kind: "session"; lines: string[] }
  | { kind: "graph"; nodes: string[]; edges: [string, string][] }

export type Rectangle = {
  id: string
  title: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  z: number
  content: RectangleContent
}

export type RectangleEvent =
  | { type: "moved"; id: string; position: Rectangle["position"] }
  | { type: "raised"; id: string }
  | { type: "undo" }
  | { type: "redo" }

export type RectangleJournal = { events: RectangleEvent[]; cursor: number }
export type RectangleModel = {
  events: { $: Signal$<RectangleEvent> }
  journal: { $: Signal$<RectangleJournal> }
  rectangles: { $: Signal$<Rectangle[]> }
}

export function replayRectangles(initial: Rectangle[], journal: RectangleJournal): Rectangle[] {
  return journal.events.slice(0, journal.cursor).reduce((rectangles, event) => {
    if (event.type === "moved") {
      return rectangles.map(rectangle =>
        rectangle.id === event.id ? { ...rectangle, position: event.position } : rectangle,
      )
    }
    if (event.type === "raised") {
      return rectangles.map(rectangle =>
        rectangle.id === event.id ? { ...rectangle, z: Math.max(...rectangles.map(({ z }) => z)) + 1 } : rectangle,
      )
    }
    return rectangles
  }, initial)
}

export function reduceRectangleJournal(journal: RectangleJournal, event: RectangleEvent): RectangleJournal {
  if (event.type === "undo") return { ...journal, cursor: Math.max(0, journal.cursor - 1) }
  if (event.type === "redo") return { ...journal, cursor: Math.min(journal.events.length, journal.cursor + 1) }
  const events = [...journal.events.slice(0, journal.cursor), event]
  return { events, cursor: events.length }
}

export function createRectangleModel(initial: Rectangle[]): RectangleModel {
  const events = SignalCreator<RectangleEvent>({ event: true })
  const journal = Signal(events.$.pipe(scan(reduceRectangleJournal, { events: [], cursor: 0 } as RectangleJournal)), {
    events: [],
    cursor: 0,
  })
  const rectangles = Signal(journal.$.pipe(map(value => replayRectangles(initial, value))), initial)
  return { events, journal, rectangles }
}
