---
title: What a signal is
---

# What a signal is

A signal is a value you can read right now and subscribe to for later, behind one object.

```ts
const count = Signal(0)
count.$()      // read, right now
count.$(5)     // write
count.$        // the BehaviorSubject, for pipe and subscribe
```

`.$()` with no argument reads. `.$(next)` writes. `.$` on its own is the RxJS stream, so every
operator you already know applies. There is no second object holding the setter, and no prop pair
of a value and an `onChange` beside it: the signal is both halves.

<SignalDemo id="state-counter" />

## The three surfaces

| you write | you get | when to reach for it |
| --- | --- | --- |
| `count.$()` | the current value, synchronously | inside a render, a handler, a reducer |
| `count.$(next)` | the write, applied before the call returns | a click, a response, a reducer |
| `count.$` | a `BehaviorSubject<number>` | anywhere an Observable belongs |

## What that buys

A read is synchronous, so nothing has to be staged into component state before it can be used. A
write is synchronous, so the next read sees it. The stream is a real `BehaviorSubject`, so
`debounceTime`, `switchMap`, `withLatestFrom` and the rest compose without an adapter.

```
step 0  count.$()      -> 0          nobody is subscribed yet
step 1  count.$(5)                   the subject holds 5
step 2  count.$()      -> 5          the read is the subject's current value
step 3  subscribe                    a late subscriber is handed 5 immediately
step 4  count.$(6)     -> emits 6    everyone observing hears it
```

That trace is the state form. Three other forms take the same three surfaces and change where the
value comes from, which is what [the four forms](./forms) is about.

## Effects live in the stream

Nothing on this site calls `.subscribe(` in a page, an example, or a demo. An effect is a `tap` in
the chain, and the thing that runs the chain is `runWhenInView`, which takes one argument:

```ts
const shown$ = count.$.pipe(tap((it) => label.write(String(it))))
const stop = runWhenInView(shown$)
```

`runWhenInView` opens the subscription when the demo reaches the viewport and closes it when the
demo leaves, so a page carrying fifteen live demos costs what the reader is looking at. It comes
from `@hafley66/docs-kit` and it is the only thing on this site that subscribes.
