---
title: The constructor takes four things
---

# The constructor takes four things

One name, four call shapes. What you hand `Signal` decides where the value comes from; the read
surface and the write surface are the same in all four.

```ts
const count = Signal(0)                       // state
const rows = Signal(fetch$)                   // source
const doubled = Signal(() => count.$() * 2)   // computed
const clicked = Signal<number>()              // event
```

| you pass | the form | current value | emits when |
| --- | --- | --- | --- |
| a plain value | [state](./form-state) | the value, from the first read | something writes |
| an `Observable` | [source](./form-source) | `undefined` until the first emission | the observable emits |
| an `Observable` and a default | [source](./form-source) | the default, from the first read | the observable emits |
| a function of no arguments | [computed](./form-computed) | the body's result, cached | a signal the body read changes |
| nothing | [event](./form-event) | there is none | something writes |

## How the constructor tells them apart

```
step 0  Signal(0)                     0 is not a function and not an Observable  -> state
step 1  Signal(fetch$)                isObservable(fetch$)                       -> source
step 2  Signal(fetch$, { loading })    the same, with the second argument held    -> source
step 3  Signal(() => count.$() * 2)   typeof is "function", arity 0              -> computed
step 4  Signal()                      no argument at all                         -> event
```

`Signal` is declared at `src/2_Signal.ts:37`, and the five overloads above it are the five rows of
that trace. [Every export](./reference-api) prints them as the compiler resolves them.

## Which one to reach for

A value the application owns is state. A value something else owns is a source. A value implied by
other values is computed. A thing that happened, with no value to hold afterwards, is an event.

Three of the four hold a current value, so `.$()` always answers. The event form is the one that
does not, and that is the only difference in the read surface across all four.
