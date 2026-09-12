import { type Observable, type OperatorFunction, scan } from "rxjs"

export type Tick<Event> = {
  tick: number
  events: readonly Event[]
}

export type Transition<State, PureEffect, ExternalEffect> = {
  state: State
  pure?: readonly PureEffect[]
  external?: readonly ExternalEffect[]
}

export type Program<State, Event, PureEffect, ExternalEffect> = {
  initial: State
  reduce: (state: State, event: Event) => Transition<State, PureEffect, ExternalEffect>
  expand: (state: State, effect: PureEffect) => readonly Event[]
  maxEventsPerTick: number
}

export type TraceEntry<Event, PureEffect> =
  | { phase: "reduce"; ordinal: number; event: Event }
  | { phase: "expand"; ordinal: number; effect: PureEffect; produced: number }

export type Frame<State, Event, PureEffect, ExternalEffect> = {
  tick: number
  state: State
  pendingExternal: readonly ExternalEffect[]
  trace: readonly TraceEntry<Event, PureEffect>[]
}

/** Settle one tick synchronously. The event queue is FIFO and exists only for this call. */
export function settle<State, Event, PureEffect, ExternalEffect>(
  program: Program<State, Event, PureEffect, ExternalEffect>,
  previous: { tick: number; state: State },
  input: Tick<Event>,
): Frame<State, Event, PureEffect, ExternalEffect> {
  if (input.tick !== previous.tick + 1) {
    throw new Error(`Expected tick ${previous.tick + 1}, received ${input.tick}`)
  }

  const queue = [...input.events]
  const pendingExternal: ExternalEffect[] = []
  const trace: TraceEntry<Event, PureEffect>[] = []
  let state = previous.state
  let ordinal = 0
  let cursor = 0

  while (cursor < queue.length) {
    if (ordinal >= program.maxEventsPerTick) {
      throw new Error(`Tick ${input.tick} exceeded ${program.maxEventsPerTick} events`)
    }

    const event = queue[cursor]
    cursor += 1
    trace.push({ phase: "reduce", ordinal, event })
    const transition = program.reduce(state, event)
    state = transition.state
    pendingExternal.push(...(transition.external ?? []))

    for (const effect of transition.pure ?? []) {
      const events = program.expand(state, effect)
      trace.push({ phase: "expand", ordinal, effect, produced: events.length })
      queue.push(...events)
    }
    ordinal += 1
  }

  return { tick: input.tick, state, pendingExternal, trace }
}

/** Compile a declarative program into one cold, per-subscription state timeline. */
export function compile<State, Event, PureEffect, ExternalEffect>(
  program: Program<State, Event, PureEffect, ExternalEffect>,
): OperatorFunction<Tick<Event>, Frame<State, Event, PureEffect, ExternalEffect>> {
  return (ticks$: Observable<Tick<Event>>) =>
    ticks$.pipe(
      scan<Tick<Event>, Frame<State, Event, PureEffect, ExternalEffect>>(
        (frame, input) => settle(program, frame, input),
        { tick: -1, state: program.initial, pendingExternal: [], trace: [] },
      ),
    )
}
