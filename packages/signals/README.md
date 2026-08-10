# @hafley66/signals

RxJS-native reactive signals with proxy-based nested access.

> **Authorship attestation:** This README was written by Claude (AI). No human has
> verified it against the source. Treat the examples as unverified until you run
> them, and check signatures against `src/` before depending on them.

📚 **[Full API Documentation](https://hafley66.github.io/hafley-rxjs/)**
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
// 1. State — BehaviorSubject, has a current value
const count = Signal(0)
count.$()      // 0
count.$(5)     // set

// 2. Source — from an observable, undefined until first emission
const data = Signal(fetch$.pipe(map(r => r.body)))
const withDefault = Signal(fetch$, { loading: true })

// 3. Computed / memo — Solid-style dep tracking, lazy + cached
const doubled = Signal(() => count.$() * 2)

// 4. Event — bare Subject, no replay, no current value
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

## `signalMap` — pipe operator

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
of(1).pipe(signalMap(n => n + global.$())).subscribe()  // logs 3
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
pnpm typecheck   # tsgo --noEmit
pnpm test        # vitest
pnpm build       # vite build
```
