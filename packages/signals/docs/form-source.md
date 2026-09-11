---
title: Source
---

# Source

`Signal(observable)` puts an Observable behind the same read surface. The signal holds whatever the
observable emitted last, and `undefined` until it emits anything.

<SignalDemo id="source-observable" />

## The second argument is the value before the first emission

```ts
const late = Signal(ticks$)        // undefined until ticks$ emits
const early = Signal(ticks$, 0)    // 0 until ticks$ emits
```

A loading state is a value rather than a flag beside one. `Signal(fetch$, { loading: true })` holds
an object a render can read on its first pass, with no branch for "the request has not started".

```
step 0  Signal(ticks$)      late.$()  -> undefined
step 0  Signal(ticks$, 0)   early.$() -> 0
step 1  ticks$ emits 1      late.$()  -> 1        early.$() -> 1
step 2  ticks$ emits 2      late.$()  -> 2        early.$() -> 2
```

The two rows converge at step 1 and stay converged. The only thing the default changes is the
window before the source has anything to say, which is exactly the window a render has to survive.

## Writing to one

A source signal accepts `.$(next)` like any other. The write lands on the subject, so readers see
it; the next emission from the observable replaces it. Use that for an optimistic value, and expect
the source to have the last word.

## Where the subscription lives

The signal subscribes its source when something observes the signal, and drops it when the last
observer leaves. Cold stays cold: an unread source signal is not running.
