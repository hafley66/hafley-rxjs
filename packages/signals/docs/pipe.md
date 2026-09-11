---
title: pipe$
---

# pipe$

`pipe` gives back an Observable, which is a thing to compose. `pipe$` runs the same operators and
gives back a Signal, which is a thing to store.

<SignalDemo id="pipe-signal" />

## The difference is the read

```ts
const settled = typed.$.pipe(debounceTime(300))    // Observable<string>
const settled$ = typed.$.pipe$(debounceTime(300))  // Signal<string>

settled$.$()          // reads, right now, no subscription
settled$.$.pipe(...)  // and it is still a stream
```

An Observable has no current value, so anything that needs one has to subscribe and hold the last
emission somewhere. `pipe$` is that somewhere, and the result takes paths and writes like any other
signal.

## Two spellings, one operator

```ts
pipe$(source$, debounceTime(300), map(it => it.trim()))   // the free function
typed.$.pipe$(debounceTime(300), map(it => it.trim()))    // the method on the accessor
```

The free function takes any `Observable` or `Signal` as its first argument. The method is the same
call with the source already bound, and it inherits the node's distinct-comparison slot, so a piped
signal keeps the deduplication the node it came from had.

## What it does not change

Cold stays cold. The operators do not run until something observes the result, and they stop when
the last observer leaves. `pipe$` adds a current value to read; it does not add a subscription.
