# @hafley66/trace

One identity and one scheduling-lag model for node, browsers and workers, printed to OpenTelemetry
resource attribute names.

## Contents

| section | question it answers |
| --- | --- |
| [identity](#identity) | who am I, who started me, what runtime is this |
| [the browser has no pid](#the-browser-has-no-pid) | what stands in for one, and where the parent link comes from |
| [a worker has no storage](#a-worker-has-no-storage) | the one channel that reaches it before its first message |
| [two renders](#two-renders) | who parents whom, and who appeared first |
| [resource](#resource) | the rename to OpenTelemetry attributes |
| [emitter](#emitter) | the shell every instrumented package was copying |
| [lag](#lag) | frame, timeout and event-loop delay, one shape |
| [what was bought](#what-was-bought) | the libraries this does not replace |

## Identity

```ts
import { ident, resource } from "@hafley66/trace"

const me = ident({ service: "signal-grid", namespace: "hafley" })
// { service, namespace, instance, pid, parent, runtime, version, born, prefix }
console.log(me.prefix)        // signal-grid/nodejs:48231
```

| field | attribute | node | browser | worker |
| --- | --- | --- | --- | --- |
| `service` | `service.name` | yours, else `OTEL_SERVICE_NAME`, else `npm_package_name` | yours | the name its host gave it |
| `namespace` | `service.namespace` | yours, else `OTEL_SERVICE_NAMESPACE` | yours | yours |
| `instance` | `service.instance.id` | a uuid per call | a uuid per call | a uuid per call |
| `pid` | `process.pid` | `process.pid` | the tab id | a fresh uuid |
| `parent` | `process.parent_pid` | `process.ppid` | the opener's tab id | the host's pid |
| `runtime` | `process.runtime.name` | `nodejs`, `bun`, `deno` | `browser` | `browser` |
| `born` | `process.creation.time` | `performance.timeOrigin` | `performance.timeOrigin` | `performance.timeOrigin` |

Every field takes an override, and an override of `undefined` means absent rather than "fall back",
because a test has to be able to say so.

## The browser has no pid

`sessionStorage` is per tab and survives a reload, which is the process-shaped lifetime a page has.
Measured in chromium:

| question | answer |
| --- | --- |
| survives a reload | yes, same id |
| a second tab gets its own | yes |
| **`window.open` copies it into the new tab** | **yes** |

That copy is the parent link. A document with `window.opener` set, or one below `window.top`, is
reading an id that belongs to whoever opened it: mint a fresh one and keep the copied value as
`parent`. The result is memoized per document, so an inherited document mints once rather than on
every call.

## A worker has no storage

Measured in chromium: a `Worker` has no `sessionStorage` and no `localStorage`. It has `self.name`,
and the name is set at construction, which makes it the only channel that arrives before the first
message.

```ts
import { ident, workerName } from "@hafley66/trace"

// host
new Worker(url, { name: workerName(ident().pid, "sorter") })   // "hafley:0bfcc223:sorter"

// inside the worker
ident()      // { pid: <fresh>, parent: "0bfcc223", service: "sorter", runtime: "worker" }
```

## Two renders

Three fields carry the whole model, and the same list of `Ident` draws two ways.

| field | what it is | which render |
| --- | --- | --- |
| `pid` | who am I, not unique | neither, alone |
| `born` | when I started | the gantt, and the sibling order in the tree |
| `parent` | who started me | the tree edge |
| `pid@born` | the key, from `key(id)` | printed on both |

An operating system reuses a pid and cannot reuse one at the same instant, so `key()` is the join a
child's `parent` resolves against. That is also why `born` has to be the process start rather than
module-load time: in node it reads `performance.timeOrigin`, which matches
`Date.now() - process.uptime() * 1000` and predates the first import.

```
tree(session)                          gantt(session, { width: 48 })

node pnpm 40112@…560782                                +--------------------------------+ 0 to 9000ms
`-- node vite 48231@…560962            node pnpm       |#===============================| 0ms
    `-- node vitest 48260@…561022      node vite       | #==============================| 180ms
tab signal-grid 0bfcc223@…562682       node vitest     | #==============================| 240ms
|-- wrk sorter a71f@…563182            tab signal-grid |      #=========================| 1900ms
|-- wrk sorter b03e@…563192            wrk sorter      |        #=======================| 2400ms
`-- tab signal-grid 25f930b9@…565982   wrk sorter      |        #=======================| 2410ms
    `-- wrk sorter c918@…566382        tab signal-grid |                  #=============| 5200ms
                                       wrk sorter      |                    #===========| 5600ms
```

Two forests, not one. `pnpm` never parents the browser tab, because a tab's parent is its opener and
a dev server is not that. The two join on `service.name`, which is what a collector groups by
anyway. The second tab is a `window.open` from the first, so that edge does exist.

## Resource

```ts
resource(ident({ service: "grid" }))
// { "service.name": "grid", "service.instance.id": "…", "process.pid": "…",
//   "process.parent_pid": "…", "process.creation.time": …, "process.runtime.name": "browser",
//   "telemetry.sdk.language": "javascript" }
```

Nothing here imports OpenTelemetry. The attribute names are the contract and they are strings, so a
consumer with no collector still emits a record every backend already understands. An absent field
is left out rather than printed as `undefined`.

## Emitter

The shell `signals/src/0_log.ts` and `signal-grid/src/0_log.ts` both carry. Diffed with package names
normalised, those two files differ by eighteen lines and every one is a comment.

```ts
const LOG = emitter("signal-grid")
setEmit(LOG, stamped(sink))          // every record carries pid, parent, service, instance
if (LOG.on) LOG.emit(CAT_DOM, "wrote {rows}", { rows, durationMs })
```

`on` is checked first and nothing else happens when it is false, so a hot loop does not pay to be
explainable.

## Lag

Ask for a tick, record how late it was.

```ts
lag$("raf", 1000).subscribe(...)     // at the application's boundary, never in a library
```

| kind | node | browser | worker |
| --- | --- | --- | --- |
| `raf` | no | yes | no |
| `timeout` | yes | yes | yes |
| `eventloop` | yes | no | no |

`lagKinds()` reports what this runtime can run. A `raf` window also folds Long Animation Frames, so
`scriptMs` and `styleLayoutMs` split the frame into the work a package's own stage timers can see
and the work they cannot. That split is why a column resize written every frame reads as cheap to
every stage timer in the process and still costs the frame.

The observable is cold: nothing is scheduled until a subscriber arrives, and the teardown cancels
the tick.

## What was bought

This package is the join, not a logger and not an SDK.

| job | library | why not here |
| --- | --- | --- |
| the attribute vocabulary | [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/resource/) | `ATTR` mirrors the names; the spec is upstream |
| the emit API and formatting | [@logtape/logtape](https://github.com/dahlia/logtape) | 0 deps, runs both sides, already the sink |
| transport to a collector | `@opentelemetry/sdk-*`, `@logtape/otel` | already wired in `@hafley66/vitest-telemetry` |
| node runtime metrics | `@opentelemetry/instrumentation-runtime-node`, `node:perf_hooks` | GC and heap belong there |
| browser field metrics | [web-vitals](https://github.com/GoogleChrome/web-vitals) | 0 deps, ships the real user metrics |

What has no prior art, and is the reason this package exists: a browser and worker identity that
answers the same three questions a pid does, and one `Lag` shape both runtimes fill.
