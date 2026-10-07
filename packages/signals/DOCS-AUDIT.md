# docs/ audit against src/

Every factual claim in `docs/*.md` checked against the source in `src/` and its tests.
Verdicts: **WRONG** (contradicts source), **STALE** (references a gate/API that moved), **UNSUPPORTED** (convention stated as mechanism), **OK**.

Source-structure note up front: `src/11_pipe.ts` does not exist. `pipe$` is the free function in `src/2_Signal.ts:156-162` plus the `.$` accessor method wired in `src/1_SignalCreator.ts:301-309`; `pipe` falls through the lazily-bound Observable-method branch (`1_SignalCreator.ts:330-357`). Only `11_pipe.test.ts` exists.

---

## docs/what-a-signal-is.md

| claim | verdict |
| --- | --- |
| `count.$()` reads / `count.$(5)` writes / `count.$` is the stream | OK (`0_types.ts:33-37`, `1_SignalCreator.ts:293-294`) |
| no second object holding the setter; `.$(next)` returns the signal | OK (`0_types.ts:36-37`) |
| read/write synchronous | OK (`1_SignalCreator.ts:154-166, 200-211`) |
| "`count.$` — a `BehaviorSubject<number>`" (table) and "The stream is a real `BehaviorSubject`" | **WRONG as literally stated** — `.$` is a Proxy facade; only `Signal(data)` at the root is backed by a `BehaviorSubject` (`1_SignalCreator.ts:148-149`). Bare `Signal()` backs with a plain `Subject`, no replay (`2_Signal.overloads.test.ts:7-31`). `Signal(obs$)` backs with `shareReplay({refCount:true, bufferSize:1})` (`1_SignalCreator.ts:172-180`). Any **nested** node's `.$` is a shallow-distinct selector stream, not the subject (`1_SignalCreator.ts:340-355`). |
| late subscriber handed 5 immediately; everyone hears the write | OK for the state form (`2_Signal.overloads.test.ts:49-58`) |
| `runWhenInView` one-argument signature, viewport-open/close | OK, but it is a `@hafley66/docs-kit` export, not this package (`docs-kit/src/1_in_view.ts:76-79, 92-93`) |

Missing-but-important:
- The page teaches only the state form and defers to `./forms`, but never warns that its own behavioral claims ("real BehaviorSubject") are form-specific.
- Bare `Signal()` event semantics absent here: lazy/shared Subject, no initial emission, no replay, `.$()` reads `undefined`, and event-mode signals are not registered as memo dependencies (`1_SignalCreator.ts:270-275`).
- `Signal(obs$)` replay-one `T | undefined` and `Signal(obs$, default)` exactly-`T` absent (`2_Signal.overloads.test.ts:62-160`).
- Writable-memo `write` slot unmentioned (`1_SignalCreator.ts:156-158, 682-690`).

---

## docs/pipe.md

| claim | verdict |
| --- | --- |
| `pipe` → Observable, `pipe$` → Signal | OK (`1_SignalCreator.ts:301-309`, `2_Signal.ts:156-162`) |
| "`settled$.$()` // reads, right now, no subscription" | **WRONG as implied.** The read is subscription-free but returns `undefined` until the shared pipeline has run under some subscriber — even a fully synchronous pipeline: `doubled.$()` is `undefined` before first subscribe, `4` after (`11_pipe.test.ts:7-14`); deferred pipelines read `undefined` until first emission (`11_pipe.test.ts:17-21`). `0_types.ts:52` says exactly this. Presented next to `debounceTime(300)`, it implies a readable settled value that is not there. |
| "An Observable has no current value... `pipe$` is that somewhere" | **WRONG as implied.** `pipe$` is the holder but does not subscribe — creation takes the lazy ref-counted branch, no probe, no keep-alive (`2_Signal.ts:158-159`); `latest` is filled only by the `tap` inside the shared pipeline while it runs (`1_SignalCreator.ts:172-180`), and a bare `.$()` read never triggers it (`1_SignalCreator.ts:230-233`). Someone else must observe before anything is held. |
| result takes paths and writes like any other signal | OK (`11_pipe.test.ts:23-29`) |
| free function takes any Observable or Signal | OK (`2_Signal.ts:71-72`, `11_pipe.test.ts:75-90`) |
| method inherits the node's distinct-comparison slot | OK (`1_SignalCreator.ts:301-309`, `11_pipe.test.ts:32-42`). Nuance: the **free function does not** forward `distinct` (`2_Signal.ts:160-162`). |
| "Cold stays cold... `pipe$` adds a current value to read; it does not add a subscription" | OK with the same caveat: "adds a current value to read" only after the pipeline has emitted under an observer. |

Missing-but-important:
- Replay-one for late subscribers (`shareReplay({refCount:true, bufferSize:1})`, `1_SignalCreator.ts:180`).
- `.$(next)` on a piped signal sets `latest` locally until the next source emission overwrites it (`1_SignalCreator.ts:154-166`).
- The undefined-before-first-subscribe window (contradicted by the snippet above).
- `pipe` on a nested node pipes the shallow-distinct selector stream, not the raw subject (`1_SignalCreator.ts:340-355`).

---

## docs/paths.md

| claim | verdict |
| --- | --- |
| every property is a signal, writes through to root | OK (`0_types.ts:24-30`, `1_SignalCreator.ts:200-211`) |
| `$.path` = `["user","name"]`; `$/pipe` surfaces | OK (`1_SignalCreator.ts:296, 416-418`) |
| emission ladder incl. step 5 quiet sibling | OK — but unconditional. Holds only under the default `SELECTOR_SLOT.distinct` operator (`1_SignalCreator.ts:64, 331-334`; `4_assumptions.test.ts:18-70`). `SignalCreatorOptions.distinct: null` restores re-emission on every root write (`0_types.ts:293-297`). |
| "The type that walks a path gates on `Record<string, unknown>`... `interface Bad` — paths stop at the root" | **WRONG/STALE.** The dotted-path union `SignalPath` is gated by `SignalPathWalks` (`0_types.ts:203-208`), which deliberately widens past `IsRecursive` — its own comment: "A path walks one anyway." Test locks it: `0_types.test.ts:75-82` asserts an `interface Row` walks `SignalPath`. Half survives: node **traversal typing** (`state.user.name` as a Signal) is still gated by `IsRecursive` (`0_types.ts:181-189`), so the closing "difference is whether `state.user.name` typechecks" is true. |

Missing-but-important:
- `SELECTOR_SLOT` / `distinct: null` opt-out unmentioned while step 5 silently depends on it.

---

## docs/slice.md

| claim | verdict |
| --- | --- |
| four-returns table, ordering reduce → `state.$` → `actions$`, `epics$` never emits | OK (`10_slice.ts:14-19, 41-46, 63-64`; `10_slice.test.ts:14-18, 33-40, 44-62`) |
| step 4 epic sees post-reduce state | OK (`10_slice.test.ts:33-40`) |
| bus queue-scheduled and multicast; nested dispatch bounded | OK (`10_slice.ts:39`; `10_slice.test.ts:90-104`) |
| "An epic never writes state... every state transition has exactly one author" | **UNSUPPORTED** — convention, not mechanism. `Epic` receives the live `state: SignalType<S>` (`10_slice.ts:10-14`) and nothing stops a direct write or imperative `dispatch`; only the `tap(dispatch)` output path (`10_slice.ts:62`) and test discipline hold it. |
| epics cold until observed; `share`d; `runEpics` signature | OK (`10_slice.ts:54-66`; `10_slice.test.ts:67-83`) |
| step 2 always emits on dispatch | **Missing nuance:** `slice.state.$` emits only when the reducer returns a new reference (`10_slice.ts:44`); a reference-equal result announces on `actions$` (unconditional `bus.next`) but not on `state.$` (`10_slice.test.ts:21-27`). |
| `slice.state` accepts an external store signal | unmentioned, real: `state?: SignalType<S>` (`10_slice.ts:35`, tested `10_slice.test.ts:106-113`) |
| `runWhenInView(slice.epics$)` | real, but a `@hafley66/docs-kit` import, never named |

Missing-but-important (context, no doc claims): holed patterns attached to a **nested** node are never rebased to the node's path — they compare node-relative patterns against root-global write paths and will not fire despite "Patterns resolve against this node" (`12_match.ts:88-95`). `setImmer` writes bypass `signalDispatch.next` entirely (`1_SignalCreator.ts:191-196` vs `269-273`), so holed patterns never see immer-style writes.

---

## docs/signal-map.md

| claim | verdict |
| --- | --- |
| projection's signal reads tracked; re-emits on signal change and source emission | OK (`7_signalMap.ts:41, 52, 26-28`) |
| marble: source emits once, output keeps producing | OK (`7_signalMap.ts:79-81`) |
| branch swaps tracked dependency set | OK (`7_signalMap.ts:50-52`) |
| output never completes with the source; consumer owns teardown | OK (`7_signalMap.ts:81`) |
| "A projection that throws keeps the last output and resubscribes... one bad emission does not tear the operator down" | **WRONG (incomplete).** Recovery only when `lastOutput !== undefined` (`7_signalMap.ts:42-45`); a throw before ever emitting calls `subscriber.error(error)` (`:46-47`) and tears the stream down. Tests only cover the post-output throw. |

Missing-but-important: recompute emits unconditionally (no distinct check); a source `error` propagates straight to the subscriber (`:80`).

---

## docs/storage.md

| claim | verdict |
| --- | --- |
| same `.$()` / `.$(next)` surface; `StorageSignal` returns a Signal | OK (`6_Storage.ts:93-95, 42-43`) |
| fallback on absent/unparseable key | OK (`6_Storage.ts:32-35`) |
| `localStorageAdapter` "emits on: a write, and `storage` from another tab" | **WRONG** on "a write". The read stream is `readOn(["storage"], ...)` filtered by tab+key (`6_Storage.ts:63-66`) — browsers fire `storage` only in *other* tabs, so same-tab writes produce no read emission; the signal updates via its own write path. |
| `urlAdapter` row | OK (`6_Storage.ts:79, 85`) |
| `hashAdapter` row | OK (`6_Storage.ts:102, 108-109`) |
| `historyAdapter` "reads from: the history entry's state; writes with: `history.replaceState`" | **WRONG on both cells.** Reads `new URLSearchParams(location.search).get(key)` (`:121`) — the query string; writes with **`history.pushState`** (`:130`), skipping unchanged values (`:126-127`). Source comment: "urlAdapter with pushState instead of replaceState: every write is a new history entry" (`:117-118`). |
| `StorageSignal` wraps only localStorage; others via `storageSignal` directly | OK (`6_Storage.ts:93-94`) |
| encode/decode defaults, failed parse falls back | OK (`6_Storage.ts:11-14, 28-29, 34`) |
| `close()` semantics | OK (`6_Storage.ts:23, 48-51`). Minor: `StorageSignal`'s declared return type is plain `SignalType<T>` (`:93`) though the runtime object carries `close()`. |

Missing-but-important: same-tab writes never echo through the read stream (live read sub guards `next !== signal.$()`, `:44-46`); synchronous one-shot seed subscribe (`reads === 2`, `disposed === 1` test); `urlAdapter`/`hashAdapter` delete the param on `""`, `hashAdapter` omits `#` when params empty (`:108-109`); `historyAdapter` skips unchanged writes; a closed signal still reads/writes its own value.

---

## docs/route.md

| claim | verdict |
| --- | --- |
| `route.$()` shape, `matched: false` on miss | OK (`5_Route.ts:65-71`) |
| "a typo in the read is a compile error rather than an `undefined` at runtime" | **WRONG.** `RouteValue` carries a string index signature `[query: string]: string | boolean` (`5_Route.ts:14`) so query fields ride flat — any property name compiles (`route.$().idy` types as `string | boolean`). Runtime `undefined` on a miss is what actually happens. |
| flat-value claim (template vs query fields) | OK (`5_Route.ts:68-71, 84-94, 100-102`). Caveats omitted: a path param **shadows** a same-named query param (path spread wins); on a miss query fields ride while template fields drop; runtime values are strings. |
| `popstate` + `instant:navigate` | OK (`5_Route.ts:75-76, 102`) |
| "several route signals on one template hold one listener between them" | **WRONG.** The `changes` observable is built per `Route()` invocation with no module-level cache keyed by template (`5_Route.ts:73-82`). Sharing is within one instance (`shareReplay({bufferSize:1, refCount:true})`, `:82`); two `Route("/users/:id")` calls hold two listener pairs. The "no listener while nobody reads" half is OK. |
| four-moves table | OK (`5_Route.ts:84, 100-105`), untested in browser suite |
| `route.template` | OK (`5_Route.ts:106`) |

Missing-but-important: values are strings (navigate coerces, booleans print `"true"`); `href`/`navigate` skip `null`/`undefined` extras entirely — a navigate call cannot clear a query param; `child()` concatenates templates keeping the base (`:107`); `matchPath` matches an arbitrary pathname (`:108`).

---

## docs/react.md

| claim | verdict |
| --- | --- |
| plugin declared at `src/vite-plugin.ts:6`; `enforce: "post"`; whole plugin is a string replacement | OK (`vite-plugin.ts:6-18`; it rewrites both `react/jsx-runtime` and `react/jsx-dev-runtime`) |
| `track` declared at `src/4_jsxAuto.ts:8`, WeakMap per function, stable component type | OK (`4_jsxAuto.ts:6-17`, `3_react.ts:29-82`) |
| per-render ladder: collector opens, reads route through `signalDispatch`, commit compares sets, `skip(1)`, unmount unsubscribes | OK (`3_react.ts:33-78`; collector null outside render, `:16-23`) |
| "A signal is a `BehaviorSubject`, so subscribing hands you the current value at once" (justifying `skip(1)`) | **Form-specific, stated unconditionally.** True for the state form root and nested selector nodes (shareReplay latest). For a bare event-form signal read in a component there is no current value — the `skip(1)` instead swallows the first real emission. |
| unchanged case does nothing (query teardown avoidance) | OK (`3_react.ts:50-57`) |
| `SignalReact_<n>_<name>` display name | OK (`3_react.ts:31`) |
| `useSignal`: takes the accessor, React state, throttles to one animation frame, subscribes regardless | OK (`3_react.ts:91-105`) |
| only render reads subscribe; writes unchanged | OK (`3_react.ts:41-48, 268-284` of SignalCreator: collector consulted only in the `.$()` read path) |
| `DESIGN-react-binding.md` and `5_jsx.jsx-e2e.test.tsx` exist | OK |

Missing-but-important: the two-copy hazard paragraph is accurate; the event-form `skip(1)` edge is not.


## docs/forms.md

| claim | verdict |
| --- | --- |
| table of five rows (state / source / source+default / computed / event) | OK per row (`2_Signal.ts:36-41`, `2_Signal.overloads.test.ts:7-160`) |
| "`Signal` is declared at `src/2_Signal.ts:37`, and the five overloads above it are the five rows" | **STALE/WRONG.** There are **six** overloads (`2_Signal.ts:36-41`): the sixth is the scan form `Signal(scan, seed, options?)` where the body is handed its own previous value (`1_SignalCreator.ts:445-446`). The declaration line is 36, impl at 42. |
| constructor disambiguation trace (isObservable / function arity / bare) | OK for the five shapes shown; arity-1 + seed is the missing branch |

Missing-but-important:


## docs/form-state.md

| claim | verdict |
| --- | --- |
| value present before subscribers, survives subscriber loss, late subscriber handed it | OK (`1_SignalCreator.ts:148-149, 154-166`) |
| write applied before `.$(next)` returns | OK (synchronous `pushState`) |
| "A `BehaviorSubject`. `count.$` is that subject, with two call signatures added" | **Overstated** — same facade point as `what-a-signal-is.md`: `count.$` is a Proxy whose methods bind lazily to the backing subject (`1_SignalCreator.ts:330-357`); true at the root of this form, false for nested nodes and other forms. |
| setImmer: recipe against an Immer draft, one `next` on the subject | OK (`1_SignalCreator.ts:191-197` → `setter` → `pushState` → one `state$.next`). Edge not mentioned: immer writes emit no `"set"` event on `signalDispatch` — only direct `.$(next)` does (`:268-273`), so `match$` holed patterns never see immer-style writes. |


## docs/form-source.md

| claim | verdict |
| --- | --- |
| holds last emission, `undefined` until first; default form exactly-`T` | OK (`2_Signal.overloads.test.ts:62-160`) |
| "the two rows converge at step 1 and stay converged" | OK |
| writing to a source signal: write lands on the subject, readers see it, next source emission replaces it | OK (`1_SignalCreator.ts:169-180` — write subject merged with source via `shareReplay({refCount:true, bufferSize:1})`; source `tap` takes over `latest`) |
| subscribes source on first observer, drops on last | OK (`1_SignalCreator.ts:180` refCount) |


## docs/form-computed.md

| claim | verdict |
| --- | --- |
| body runs, cached, re-runs on read-signal change; dependency set from last run; branches swap deps | OK (`1_SignalCreator.ts:78-130` stack-scoped tracking; `2_Signal.memo.test.ts`) |
| lazy until read, cached until dependency moves | OK (`1_SignalCreator.ts:650-658`) |
| "numbers its memos `memo#1`, `memo#2`" | OK (`1_SignalCreator.ts:467`) |
| "Pass a name to make a record traceable to a call site: `createComputedSignal(() => ..., "sorted")`" | **WRONG.** Signature is `createComputedSignal(compute, seed?, options?)` (`1_SignalCreator.ts:466`) — no name parameter exists (`ComputedOptions` holds only `writable`, `:448-451`). Passing `"sorted"` sets the **seed** to the string `"sorted"` and `hasValue` to true. Memo ids are auto-numbered and cannot be overridden. |

Missing-but-important: reading an event-form signal inside a computed body does **not** create a dependency — event-mode signals are excluded from memo tracking (`1_SignalCreator.ts:280-282`).


## docs/form-event.md

| claim | verdict | evidence |
| --- | --- | --- |
| bare Subject, no current value, no replay, `.$()` → `undefined`, late listener hears nothing | OK (`1_SignalCreator.ts:148-149`; `2_Signal.overloads.test.ts:7-31`) |
| state-vs-event table | OK | — |

Missing-but-important: event-form reads are invisible to computed tracking (above); a bare event signal read in a tracked component + `skip(1)` means the first real emission is swallowed (`3_react.ts:64-66`).


## docs/install.md

| claim | verdict |
| --- | --- |
| `rxjs`, `immer`, `lodash` are real dependencies rather than peers | OK (`package.json` `dependencies`) |
| subpaths: `.`, `./Signal`, `./react`, `./jsx-runtime`, `./vite` | OK (`package.json` `exports`); `./jsx-dev-runtime` also ships and is unmentioned |
| `react` and `vite` optional peers; LogTape optional peer | OK (`peerDependenciesMeta`) |
| `enableSignalLogTape` / `setSignalLogEmit` / `disableSignalLogging` exports | OK (`0_log.ts:21-33`) |
| "lodash is used for the structural comparisons the proxy needs" | Loose: lodash supplies `get`/`set`/`isEqual` (`1_SignalCreator.ts:33`); the selector distinct comparison is hand-rolled `shallowEqual` (`1_SignalCreator.ts:50-64`) |


---

## Red/green verification (2026-10-07)

Throwaway probes exercised every WRONG/UNSUPPORTED claim that lacked direct suite coverage; all
passed against source, falsifying the doc claims. Probes deleted after the run.

| claim | probe result |
| --- | --- |
| `signalMap` first-run throw errors the subscriber (doc claims recovery) | GREEN — `subscriber.error` received on first-run throw |
| `signalMap` post-output throw recovery | GREEN — last output held, next success emits; no stream teardown |
| `signalMap` re-emits equal projection values (no distinct gate) | GREEN — `"same"` twice for two source emissions |
| epic writes state directly, bypassing reduce (doc: "never writes state") | GREEN — direct `state.$({n:999})` from an epic succeeds; nothing enforces the contract |
| `createComputedSignal(fn, "sorted")` — string arrives as `prev` seed, not a name | GREEN — first run sees `prev === "sorted"`; no name parameter exists |
| `match$` exact pattern on a nested node fires | GREEN — control confirms exact-pattern machinery works at any depth |
| `match$` holed pattern on a nested node never fires (not rebased to the node path) | GREEN — while a holed pattern at the root (`user.{field}`) fires on the same write |
| `setImmer` writes emit no `set` event; holed `match$` is blind to them | GREEN — seat write (`items[0].$(9)`) dispatches `set:items.0` and fires the handler; the immer write dispatches nothing |
| Route typo read compiles as `string or boolean` (doc claims compile error) | GREEN — `route.$().idy` types as `string or boolean` and reads `undefined` |
| Two `Route()` calls on one template hold two popstate listener pairs (doc claims one) | GREEN — two add/remove pairs observed |
| `localStorageAdapter` same-tab write emits no read-stream emission (doc claims "emits on a write") | GREEN — one synchronous seed only; signal updates via its write path |
| `historyAdapter` reads query string, writes `pushState`, skips unchanged (doc: entry state + `replaceState`) | GREEN — `history.state` stays null, `history.length` increments once, second identical write skipped |

Notes from the probe run, recorded for the WIP lane:

- The `match$`/`switch$` postfix form is `node.match$({ pattern: handler })` — handlers object
  only. The bridge (`special$.match$`, `1_SignalCreator.ts:413` + `12_match.ts:99`) passes the node
  and forwards handlers; calling it with a pattern string as the first argument silently
  string-enumerates it into per-character exact patterns whose handlers then throw inside the
  error-containment of `run()`. A guard rejecting a string `handlers` would turn that into a
  visible error.
- `historyAdapter`'s read stream emits `""` for an absent param (the fallback applies at the
  signal-decode layer, not on the read stream).

## docs/reference-api.md

Generated file — header states it is read out of the TypeScript program by `packages/docs-kit/scripts/api.mjs` and hand edits are overwritten. No verdicts against source; correctness is owned by the generator, and the working tree carries an uncommitted regeneration of it. If a claim there is wrong, fix `packages/docs-kit/scripts/api.mjs` and re-run, not this file.
