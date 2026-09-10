---
"@hafley66/signals": minor
---

Nested-path selectors dedupe by default, and gain a slot for the comparison.

A write to any branch of a signal tree used to re-emit on every other branch's selector, so a subscribed computed downstream re-ran its whole body. Measured in `@hafley66/signal-grid`: one `colWidth` write at 50,000 rows cost 76 ms because it re-sorted every row through the `sort` selector. It now costs 0.0 ms.

- `distinctShallow()` is the default at `SELECTOR_SLOT.distinct`. `shallowEqual` compares one level, which is exactly what immer's per-branch structural sharing gives you.
- `SignalCreatorOptions.distinct` takes any `MonoTypeOperatorFunction`, or `null` for the previous behaviour.
- `createComputedSignal` diffs its dependency subscriptions instead of tearing every one down and rebuilding on each run, and `inEmitTurn` coalesces the invalidations raised by one root emit so a memo body runs once per write rather than once per dependency.
- `pipe$` returns a Signal rather than an Observable, as a method on the accessor and as a free function over an Observable or an existing Signal, up to ten operators.
- `storageSignal` returns a `close()`. Without it every call left a live `popstate` listener whose closure pinned the signal and everything derived from it.
- `createComputedSignal` no longer lets a pull swallow a queued push. `recompute("read")` cleared
  `dirty` without notifying, because a pull hands the value straight to its caller, so a downstream
  memo that read a queued-but-unflushed memo starved that memo's own subscribers, transitively. A
  queued invalidation now still owes its observers a push after a pull satisfied the recompute.
  Symptom in `@hafley66/signal-grid`: writing `state.orientation` emitted on two of four derived
  stages and the render plan kept the previous axis permanently.
- LogTape instrumentation behind `SIGNALS_LOG`, at no measured cost when off.

Behaviour change worth reading: three tests that documented the old no-dedupe contract now document the new one, and three were added proving `distinct: null` restores it.
