---
title: createSlice and epics
---

# createSlice and epics

A reducer over a state signal, one action bus, and epics that turn actions into more actions.

<SignalDemo id="slice-epics" />

## The four things it hands back

```ts
const slice = createSlice<State, Action, Ctx>({ initial, reduce, epics, ctx })
```

| member | type | what it is |
| --- | --- | --- |
| `slice.state` | `Signal<State>` | the reduced state, readable at any time with `.$()` |
| `slice.dispatch` | `(action) => void` | reduces synchronously, then re-emits on `actions$` |
| `slice.actions$` | `Observable<Action>` | every dispatched action, after its own reduce |
| `slice.epics$` | `Observable<never>` | never emits; observing it is what makes the epics live |

`slice.state` is a signal, so a consumer reads `slice.state.items.$()` and gets a path signal, with
everything [a path](./paths) does.

## Dispatch reduces before it announces

```
step 0  dispatch({ type: "add", by: 3 })
step 1  reduce runs, state becomes { items: 6 }
step 2  slice.state.$ emits { items: 6 }
step 3  actions$ emits { type: "add", by: 3 }
step 4  an epic reading state.$() at step 3 sees 6, never 3
```

Step 4 is the ordering that makes an epic able to read the state its own action produced. The bus is
queue-scheduled and multicast, so a dispatch made inside an observer reaches everyone after the
current action has, which bounds the recursion rather than interleaving it.

## An epic is one action in, another action out

```ts
const doubler: Epic<Action, State, Ctx> = (actions$, state) =>
  actions$.pipe(
    filter((it) => it.type === "double-please"),
    map(() => ({ type: "add", by: state.items.$() })),
  )
```

An epic never writes state. It asks for a change by emitting an action, which goes back through
`dispatch` and through `reduce`, so every state transition has exactly one author.

## Epics are cold until observed

Nothing in an epic runs until something observes `epics$`. That is the seam a page uses to decide
when a feature is live:

```ts
const stop = runWhenInView(slice.epics$)
```

Scroll the demo above out of view and `double-please` stops doubling, because the epic that turns it
into an `add` is no longer running. Scroll it back and it works again. The reducer never stopped:
`dispatch` and `slice.state.$()` are synchronous and owe nothing to a subscription.

`epics$` is `share`d, so several observers run one copy of the epic set. `runEpics(actions$, state,
ctx, epics, dispatch)` builds the same thing for an extra set a feature wants to add later.
