---
title: Event
---

# Event

`Signal<T>()` with no argument is a bare Subject. No current value, no replay, nothing held between
writes. It is the form for a thing that happened.

<SignalDemo id="event-bus" />

## What the missing replay means

```ts
const clicked = Signal<number>()
clicked.$(1)
clicked.$()        // undefined
```

A listener attached after `clicked.$(1)` hears nothing about it. That is the difference from the
state form, and it is the reason to reach for this one: a "save requested" that replays on every
new subscriber fires a save per subscriber.

```
step 0  Signal<number>()      no value held
step 1  A subscribes
step 2  clicked.$(1)          A hears 1
step 3  B subscribes          B hears nothing
step 4  clicked.$(2)          A hears 2, B hears 2
step 5  clicked.$()  -> undefined
```

Compare step 3 against step 3 of [state](./form-state), where the newcomer is handed the current
value. That one line is the whole difference between the two forms.

## When to use which

| the thing | form |
| --- | --- |
| the current filter | state |
| the user asked to save | event |
| the row that is selected | state |
| the row was double-clicked | event |
| the last error | state, so a render can show it |
| a toast should appear | event, so it appears once |

The test is whether a new reader arriving late should be told. A filter, yes. A double-click, no.
