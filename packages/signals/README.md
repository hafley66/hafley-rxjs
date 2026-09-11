# @hafley66/signals

RxJS-native reactive signals with proxy-based nested access.

> **Authorship attestation:** This README was written by Claude (AI). No human has
> verified it against the source. Treat the examples as unverified until you run
> them, and check signatures against `src/` before depending on them.

📚 **[The documentation site](https://hafley66.github.io/hafley-rxjs/signals/)**, with a live editable demo on every page and an API reference read out of the compiler.
📖 See `GUIDE.md` for signal-first application architecture and the React boundary.

---

## Install

```sh
npm install @hafley66/signals rxjs immer lodash
```

React bindings are an optional subpath:

```ts
import { SignalReact } from "@hafley66/signals/react"
```

---

## The four Signal forms

One `Signal` constructor, four call shapes. The only read surface is `.$()`;
the only write surface is `.$(value)`.

```ts
// 1. State, BehaviorSubject, has a current value
const count = Signal(0)
count.$()      // 0
count.$(5)     // set

// 2. Source, from an observable, undefined until first emission
const data = Signal(fetch$.pipe(map(r => r.body)))
const withDefault = Signal(fetch$, { loading: true })

// 3. Computed / memo, Solid-style dep tracking, lazy + cached
const doubled = Signal(() => count.$() * 2)

// 4. Event, bare Subject, no replay, no current value
const click = Signal<number>()
click.$(1)
```

Nested access auto-traverses through a proxy; each path is itself a Signal.

```ts
const state = Signal({ user: { name: "chris" } })
state.user.name.$()       // "chris"
state.user.name.$("sam")  // writes through to the root
state.user.name.$.path    // ["user", "name"]
```

Mutate with Immer recipes via `.setImmer`, and watch meta events on `.$.$`.

---

## `createSlice` and epics

A reducer over a state signal, one action bus, and epics that turn actions into
more actions. `dispatch` reduces synchronously; epics run only while `epics$` is
subscribed.

```ts
const slice = createSlice<State, Action, Ctx>({ initial, reduce, epics, ctx, state? })
slice.state.$()             // reduced state, any time
slice.dispatch(action)      // reduce, then re-emit on actions$
slice.actions$              // Observable<Action>, every dispatched action after its reduce
slice.epics$                // never emits; observing it is what makes the epics live, share()d

type Epic<A, S, Ctx> = (actions$: Observable<A>, state: Signal<S>, ctx: Ctx) => Observable<A>
runEpics(actions$, state, ctx, epics, dispatch)   // Observable<never>, for extra epic sets
```

```
step 0  state={n:3}   dispatch {double-please}   epics cold   -> state {n:3}
step 1  something observes epics$
step 2  dispatch {double-please} -> doubler epic emits {add, by:3} -> dispatch -> state {n:6}
step 3  the last observer leaves -> epics cold again
```

---

## `signalMap`, pipe operator

Project source emissions against tracked signal values, and re-emit when any
signal read inside the projection changes. It is the operator form of a computed
signal that also depends on an upstream observable.

```
source:   --1------------------------>
signal:   (2)----------4-------6----->
signalMap(n => n + signal.$())
output:   --3----------5-------7----->
```

```ts
import { Signal, signalMap } from "@hafley66/signals"
import { of } from "rxjs"

const global = Signal(2)
const shown$ = of(1).pipe(signalMap(it => it + global.$()), tap(console.log))
// observing shown$ logs 3
global.$(4)                                            // logs 5
global.$(6)                                            // logs 7
```

Completion is stay-open: signals (BehaviorSubjects) never complete, so the
output never completes with the source. A finite source (`of(1)`) yields an
open output that keeps re-emitting on signal change. The consumer owns teardown.

Rules:
- Reads inside the projection are collected via the same tracking as `Signal(fn)`.
- A branch change swaps which signals are tracked (dynamic dependencies).
- A transient projection error keeps the last output and resubscribes to the
  dependencies read before the throw.

---

## Producers

External state enters through producers rather than being mirrored into React.

| producer | source | use |
|---|---|---|
| `createView` / `createQuery` | `src/4_Query.js` | switchMap with per-key cache |
| `Endpoint` | `src/3_Endpoint.js` | bundle a query + its transport |
| `StorageSignal` | `src/6_Storage.js` | persisted signal |
| `Route` | `src/5_Route.js` | URL path matcher (being superseded by `@hafley66/path` route) |

---

## Build / test

```sh
pnpm typecheck   # tsc --noEmit, for src/ and for examples/
pnpm test        # vitest
pnpm build       # vite build
pnpm examples    # mount every example in a real chromium and count what survived teardown
pnpm site        # the documentation site, with every example live on its page
```

## Logging

Every reactive step emits a structured record through [LogTape](https://logtape.org), an optional
peer dependency. Nothing is installed by default: with no sink, each call site costs one boolean
read and the graph runs exactly as it did before.

| category | when | fields |
| --- | --- | --- |
| `["signals","write"]` | a `$(value)` set lands | `path`, `depth`, `hasSubscribers`, `durationMs` |
| `["signals","emit"]` | the root subject emits | `path` (the writing branch), `observerCount` |
| `["signals","selector"]` | a nested-path selector is built or resubscribed | `path`, `reason` |
| `["signals","compute"]` | a computed body runs | `id`, `durationMs`, `depCount`, `depsAdded`, `depsRemoved`, `trigger` |
| `["signals","invalidate"]` | a computed is marked dirty | `id`, `by`, `eager` |
| `["signals","subscribe"]` / `["signals","unsubscribe"]` | dependency wiring changes | `id`, `path` |

Fields are always structured values, never a pre-formatted line, so a sink can count them.

```ts
import { configure, getConsoleSink } from "@logtape/logtape"
import { enableSignalLogTape } from "@hafley66/signals"

await configure({
  sinks: { console: getConsoleSink() },
  loggers: [{ category: "signals", lowestLevel: "debug", sinks: ["console"] }],
})
await enableSignalLogTape()
```

`setSignalLogEmit(fn)` installs a raw counting sink instead, which is what a benchmark wants;
`disableSignalLogging()` puts the boolean back to false.

Each computed carries a stable id so a record traces to a call site. `createComputedSignal(fn)`
numbers them `memo#1`, `memo#2`, and so on; pass `createComputedSignal(fn, "sorted")` to name one.

### In tests

`SIGNALS_LOG` gates `vitest.setup.ts`. Unset, the suite is silent.

```sh
SIGNALS_LOG=1 pnpm test              # debug and above to stdout
SIGNALS_LOG=info pnpm test           # any LogTape level name works
pnpm test:log                        # the same thing, spelled as a script
```

## Application authoring skill

The npm package includes [skills/signals/SKILL.md](https://github.com/hafley66/hafley-rxjs/blob/main/packages/signals/skills/signals/SKILL.md). It covers recursive signal paths, grouped state, automatic JSX tracking, cold producer connections and RxJS resource lifetimes. Use it when authoring applications with this library.
