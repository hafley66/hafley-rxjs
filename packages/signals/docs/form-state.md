---
title: State
---

# State

`Signal(value)` holds what you gave it. The value is there before anything subscribes, it survives
every subscriber going away, and a late subscriber is handed it on arrival.

<SignalDemo id="state-counter" />

## The shape

```ts
const count = Signal(0)

count.$()            // 0
count.$(count.$() + 1)
count.$()            // 1
```

A write is applied before `.$(next)` returns, so the next read on the same line sees it. That is
what lets a handler read, decide and write without staging anything.

## What is underneath

A `BehaviorSubject`. `count.$` is that subject, with two call signatures added:

```
step 0  Signal(0)                subject holds 0, no observers
step 1  count.$()      -> 0      the read is subject.value
step 2  count.$(1)               the write is subject.next(1)
step 3  shown$ opens   -> 1      a new observer is handed the current value at once
step 4  count.$(2)     -> 2      every observer hears it
step 5  shown$ closes            the subject still holds 2
```

Step 3 is the part a plain `Subject` does not do, and it is why the state form never needs an
initial render to be arranged separately from an update.

## Mutating instead of replacing

`setImmer` takes a recipe and applies it as a write:

```ts
const state = Signal({ items: [1, 2, 3] })
state.$.setImmer((draft) => { draft.items.push(4) })
```

The recipe runs against an Immer draft and the result is one `next` on the subject, so an observer
sees one emission rather than one per mutation.
