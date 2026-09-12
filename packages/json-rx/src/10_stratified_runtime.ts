import { EMPTY, expand, last, map, mergeScan, type Observable, type OperatorFunction, of, throwError } from "rxjs"

export type Tick<Event> = readonly [tick: number, events: readonly Event[]]
export type Transition<State, PureEffect, ExternalEffect> = readonly [
  state: State,
  pure: readonly PureEffect[],
  external: readonly ExternalEffect[],
]
export type Program<State, Event, PureEffect, ExternalEffect> = readonly [
  initial: State,
  reduce: (state: State, event: Event) => Transition<State, PureEffect, ExternalEffect>,
  expand: (state: State, effect: PureEffect) => readonly Event[],
  maxEventsPerTick: number,
]
export type Frame<State, ExternalEffect> = readonly [
  tick: number,
  state: State,
  pendingExternal: readonly ExternalEffect[],
]

type Work<State, Event, ExternalEffect> = readonly [
  tick: number,
  expectedTick: number,
  state: State,
  events: readonly Event[],
  cursor: number,
  pendingExternal: readonly ExternalEffect[],
]

export function tick<Event>(at: number, events: readonly Event[]): Tick<Event> {
  return [at, events]
}

export function transition<State, PureEffect, ExternalEffect>(
  state: State,
  pure: readonly PureEffect[] = [],
  external: readonly ExternalEffect[] = [],
): Transition<State, PureEffect, ExternalEffect> {
  return [state, pure, external]
}

export function program<State, Event, PureEffect, ExternalEffect>(
  initial: State,
  reduce: Program<State, Event, PureEffect, ExternalEffect>[1],
  expandPure: Program<State, Event, PureEffect, ExternalEffect>[2],
  maxEventsPerTick: number,
): Program<State, Event, PureEffect, ExternalEffect> {
  return [initial, reduce, expandPure, maxEventsPerTick]
}

function begin<State, Event, ExternalEffect>(
  frame: Frame<State, ExternalEffect>,
  input: Tick<Event>,
): Work<State, Event, ExternalEffect> {
  return [input[0], frame[0] + 1, frame[1], input[1], 0, []]
}

function advance<State, Event, PureEffect, ExternalEffect>(
  source: Program<State, Event, PureEffect, ExternalEffect>,
  work: Work<State, Event, ExternalEffect>,
): Observable<Work<State, Event, ExternalEffect>> {
  if (work[0] !== work[1]) {
    return throwError(() => new Error(`Expected tick ${work[1]}, received ${work[0]}`))
  }
  if (work[4] >= work[3].length) return EMPTY
  if (work[4] >= source[3]) {
    return throwError(() => new Error(`Tick ${work[0]} exceeded ${source[3]} events`))
  }

  return of(source[1](work[2], work[3][work[4]])).pipe(map(changed => continueWork(source, work, changed)))
}

function continueWork<State, Event, PureEffect, ExternalEffect>(
  source: Program<State, Event, PureEffect, ExternalEffect>,
  work: Work<State, Event, ExternalEffect>,
  changed: Transition<State, PureEffect, ExternalEffect>,
): Work<State, Event, ExternalEffect> {
  return [
    work[0],
    work[1],
    changed[0],
    [...work[3], ...changed[1].flatMap(effect => source[2](changed[0], effect))],
    work[4] + 1,
    [...work[5], ...changed[2]],
  ]
}

function advanceWith<State, Event, PureEffect, ExternalEffect>(
  source: Program<State, Event, PureEffect, ExternalEffect>,
): (work: Work<State, Event, ExternalEffect>) => Observable<Work<State, Event, ExternalEffect>> {
  return function advanceWork(work) {
    return advance(source, work)
  }
}

function commit<State, Event, ExternalEffect>(work: Work<State, Event, ExternalEffect>): Frame<State, ExternalEffect> {
  return [work[0], work[2], work[5]]
}

function settle<State, Event, PureEffect, ExternalEffect>(
  source: Program<State, Event, PureEffect, ExternalEffect>,
  frame: Frame<State, ExternalEffect>,
  input: Tick<Event>,
): Observable<Frame<State, ExternalEffect>> {
  return of(begin(frame, input)).pipe(expand(advanceWith(source), 1), last(), map(commit))
}

function settleWith<State, Event, PureEffect, ExternalEffect>(
  source: Program<State, Event, PureEffect, ExternalEffect>,
): (frame: Frame<State, ExternalEffect>, input: Tick<Event>) => Observable<Frame<State, ExternalEffect>> {
  return function settleFrame(frame, input) {
    return settle(source, frame, input)
  }
}

function initial<State, Event, PureEffect, ExternalEffect>(
  source: Program<State, Event, PureEffect, ExternalEffect>,
): Frame<State, ExternalEffect> {
  return [-1, source[0], []]
}

/** Compile one tuple program into a cold, per-subscription state timeline. */
export function compile<State, Event, PureEffect, ExternalEffect>(
  source: Program<State, Event, PureEffect, ExternalEffect>,
): OperatorFunction<Tick<Event>, Frame<State, ExternalEffect>> {
  return mergeScan(settleWith(source), initial(source), 1)
}
