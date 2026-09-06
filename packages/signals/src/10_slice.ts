import { defer, ignoreElements, merge, Observable, share, Subject, tap } from "rxjs"
import { Signal } from "./2_Signal.js"
import type { Signal as SignalType } from "./0_types.js"

// dispatch reduces synchronously (no subscriber needed), then re-emits on actions$.
// Epics run only while epics$ is subscribed; share() lets several mounts hold one run.

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
  // Never emits. Subscribe to run the slice's epics; unsubscribe to stop them.
  epics$: Observable<never>
}

export type SliceConfig<S, A, Ctx> = {
  initial: S
  reduce: Reducer<S, A>
  epics?: readonly Epic<A, S, Ctx>[]
  ctx?: Ctx
  // Use an existing signal as the store instead of Signal(initial).
  state?: SignalType<S>
}

// Identity with a type anchor so call sites read `createEpic((actions$, state, ctx) => ...)`.
export function createEpic<A, S, Ctx = unknown>(epic: Epic<A, S, Ctx>): Epic<A, S, Ctx> {
  return epic
}

export function createSlice<S, A, Ctx = unknown>(config: SliceConfig<S, A, Ctx>): Slice<S, A> {
  const state = config.state ?? Signal<S>(config.initial)
  const bus = new Subject<A>()
  const actions$ = bus.asObservable()

  const dispatch = (action: A): void => {
    const prev = state.$()
    const next = config.reduce(prev, action)
    if (next !== prev) state.$(next)
    bus.next(action)
  }

  const ctx = config.ctx as Ctx
  const epics$ = runEpics(actions$, state, ctx, config.epics ?? [], dispatch)

  return { state, actions$, dispatch, epics$ }
}

// Every epic output is dispatched. Never emits; the subscription is the epics' lifetime.
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
