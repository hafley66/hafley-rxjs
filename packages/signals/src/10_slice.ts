import { defer, ignoreElements, merge, Observable, observeOn, queueScheduler, share, Subject, tap } from "rxjs"
import { Signal } from "./2_Signal.js"
import type { Signal as SignalType } from "./0_types.js"

export type Reducer<S, A> = (state: S, action: A) => S

export type Epic<A, S, Ctx = unknown> = (
  actions$: Observable<A>,
  state: SignalType<S>,
  ctx: Ctx,
) => Observable<A>

export type Slice<S, A> = {
  state: SignalType<S>
  actions$: Observable<A>
  dispatch: (action: A) => void
  // Never emits; subscribed = epics running.
  epics$: Observable<never>
}

type CtxField<Ctx> = unknown extends Ctx ? { ctx?: Ctx } : { ctx: Ctx }

export type SliceConfig<S, A, Ctx> = {
  initial: S
  reduce: Reducer<S, A>
  epics?: readonly Epic<A, S, Ctx>[]
  state?: SignalType<S>
} & CtxField<Ctx>

export function createEpic<A, S, Ctx = unknown>(epic: Epic<A, S, Ctx>): Epic<A, S, Ctx> {
  return epic
}

export function createSlice<S, A, Ctx = unknown>(config: SliceConfig<S, A, Ctx>): Slice<S, A> {
  const state = config.state ?? Signal<S>(config.initial)
  const bus = new Subject<A>()
  // One queue-scheduled multicast: a dispatch made inside an observer reaches everyone after the
  // current action has reached everyone (causal order, bounded recursion).
  const actions$ = bus.pipe(observeOn(queueScheduler), share())

  const dispatch = (action: A): void => {
    const prev = state.$()
    const next = config.reduce(prev, action)
    if (next !== prev) state.$(next)
    bus.next(action)
  }

  const ctx = (config as { ctx?: Ctx }).ctx as Ctx
  const epics$ = runEpics(actions$, state, ctx, config.epics ?? [], dispatch)

  return { state, actions$, dispatch, epics$ }
}

export function runEpics<S, A, Ctx>(
  actions$: Observable<A>,
  state: SignalType<S>,
  ctx: Ctx,
  epics: readonly Epic<A, S, Ctx>[],
  dispatch: (action: A) => void,
): Observable<never> {
  return defer(() => merge(...epics.map((epic) => epic(actions$, state, ctx)))).pipe(
    tap((action) => dispatch(action)),
    ignoreElements(),
    share(),
  )
}
