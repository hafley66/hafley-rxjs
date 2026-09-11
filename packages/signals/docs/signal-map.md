---
title: signalMap
---

# signalMap

The computed form as a pipe operator. The projection's signal reads are tracked, so the output
re-emits on a signal change as well as on a source emission.

<SignalDemo id="signal-map" />

## The marble

```
source:   --1------------------------>
rate:     (2)----------4-------6----->
signalMap(it => it * rate.$())
output:   --2----------4-------6----->
```

The source emits once. The output keeps producing, because `rate` is read inside the projection and
`rate` keeps moving. A plain `map` would have gone quiet after the first marble.

## When to reach for it

```ts
of(1).pipe(signalMap(it => it + global.$()))
```

Use it when an emission has to be combined with state that is not part of the stream. The
alternative is `withLatestFrom(global.$)`, which works and makes the dependency a wiring decision
rather than a consequence of the code. `signalMap` tracks whatever the body read on its last run,
so a branch inside the projection changes which signals wake it, the same way a computed body does.

## Completion is stay-open

Signals are BehaviorSubjects and never complete, so the output never completes with the source. A
finite source like `of(1)` yields an output that stays open and keeps re-emitting on a signal
change. The consumer owns teardown, which on this site means `runWhenInView`.

## Errors

A projection that throws keeps the last output and resubscribes to the dependencies it read before
the throw, so one bad emission does not tear the operator down.
