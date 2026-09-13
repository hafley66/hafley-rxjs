// Keyboard operators over plain KeyboardEvent streams: chord matching, multi-chord
// sequences, hold-to-fire, and a printable typeahead buffer. Pure RxJS; the caller
// owns the source and the subscription.
import {
  filter,
  fromEvent,
  map,
  race,
  scan,
  switchMap,
  timer,
  timestamp,
  type MonoTypeOperatorFunction,
  type Observable,
  type OperatorFunction,
} from "rxjs"

/** "Mod+K", "Shift+ArrowDown", "Escape". `Mod` is Meta on a mac platform and Control elsewhere,
 * read from `navigator.platform` once at parse. Order of modifiers in the spec does not matter.
 * A spec with no key part is invalid and `parseChord` throws with the spec in the message. */
export interface ChordSpec {
  readonly key: string
  readonly alt: boolean
  readonly ctrl: boolean
  readonly meta: boolean
  readonly shift: boolean
}

// The platform check is memoized so every parse in a process agrees on what Mod means.
let modIsMeta: boolean | undefined

function modFlag(): "meta" | "ctrl" {
  if (modIsMeta === undefined) {
    modIsMeta = /mac|iphone|ipad/i.test(navigator.platform)
  }
  return modIsMeta ? "meta" : "ctrl"
}

export function parseChord(spec: string): ChordSpec {
  const parts = spec.split("+")
  const key = parts.pop() ?? ""
  if (key.length === 0) {
    throw new Error(`invalid chord spec: ${spec}`)
  }
  const result = { key, alt: false, ctrl: false, meta: false, shift: false }
  for (const part of parts) {
    const name = part.toLowerCase()
    if (name === "mod") {
      result[modFlag()] = true
    } else if (name === "ctrl" || name === "control") {
      result.ctrl = true
    } else if (name === "alt" || name === "option") {
      result.alt = true
    } else if (name === "meta" || name === "cmd" || name === "command") {
      result.meta = true
    } else if (name === "shift") {
      result.shift = true
    } else {
      throw new Error(`invalid chord spec: ${spec}`)
    }
  }
  return result
}

// pseudo: compare the key and all four modifiers exactly, so "K" does not match Mod+K.
export function matchesChord(event: KeyboardEvent, spec: ChordSpec): boolean {
  return (
    event.key === spec.key &&
    event.altKey === spec.alt &&
    event.ctrlKey === spec.ctrl &&
    event.metaKey === spec.meta &&
    event.shiftKey === spec.shift
  )
}

function specOf(event: KeyboardEvent): ChordSpec {
  return { key: event.key, alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey }
}

// pseudo: filter(e => matchesChord(e, parsed)).
export function chord(spec: string): MonoTypeOperatorFunction<KeyboardEvent> {
  const parsed = parseChord(spec)
  return source => source.pipe(filter(event => matchesChord(event, parsed)))
}

// pseudo: scan over { at, events } with timestamp(); on match of specs[events.length] within
// window push, else reset and retry index 0; filter complete; map to events; the fold itself
// resets after emit because an out-of-range index falls into the reset branches.
export function sequence(specs: string, withinMs = 800): OperatorFunction<KeyboardEvent, readonly KeyboardEvent[]> {
  const parsed = specs.split(/\s+/).filter(part => part.length > 0).map(parseChord)
  return source =>
    source.pipe(
      timestamp(),
      scan(
        (state, tick) => {
          const index = state.events.length
          const inWindow = index === 0 || tick.timestamp - state.at <= withinMs
          if (inWindow && index < parsed.length && matchesChord(tick.value, parsed[index])) {
            return { at: tick.timestamp, events: [...state.events, tick.value] }
          }
          if (matchesChord(tick.value, parsed[0])) {
            return { at: tick.timestamp, events: [tick.value] }
          }
          return { at: 0, events: [] as KeyboardEvent[] }
        },
        { at: 0, events: [] as KeyboardEvent[] },
      ),
      map(state => state.events),
      filter(events => events.length === parsed.length),
    )
}

// pseudo: fromEvent(target, "keydown") filtered by chord and !repeat, switchMap to timer(ms)
// raced with fromEvent(target, "keyup") filtered by the same key and modifiers, filter out
// the keyup branch. switchMap teardown clears the timer on unsubscribe.
export function held(target: EventTarget, spec: string, ms: number): Observable<KeyboardEvent> {
  const parsed = parseChord(spec)
  return fromEvent<KeyboardEvent>(target, "keydown").pipe(
    filter(event => !event.repeat && matchesChord(event, parsed)),
    switchMap(down =>
      race(
        timer(ms).pipe(map(() => down)),
        fromEvent<KeyboardEvent>(target, "keyup").pipe(
          filter(up => matchesChord(up, specOf(down))),
          map(() => null),
        ),
      ),
    ),
    filter((event): event is KeyboardEvent => event !== null),
  )
}

// pseudo: filter printable, scan with timestamp() over { at, buffer }, same window logic,
// map to the buffer string.
export function typeahead(withinMs = 500): OperatorFunction<KeyboardEvent, string> {
  const printable = (event: KeyboardEvent) => event.key.length === 1 && !event.ctrlKey && !event.metaKey
  return source =>
    source.pipe(
      filter(printable),
      timestamp(),
      scan((state, tick) => {
        const prefix = tick.timestamp - state.at <= withinMs ? state.buffer : ""
        return { at: tick.timestamp, buffer: prefix + tick.value.key }
      }, { at: 0, buffer: "" }),
      map(state => state.buffer),
    )
}
