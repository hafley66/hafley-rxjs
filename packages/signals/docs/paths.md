---
title: A path is a signal
---

# A path is a signal

Every property of a signal's value is itself a signal. Not a selector, not a lens helper: the same
three surfaces, at every depth, writing through to the root.

<SignalDemo id="nested-paths" />

## The shape

```ts
const state = Signal({ user: { name: "chris" } })

state.user.name.$()          // "chris"
state.user.name.$("sam")     // writes through to the root
state.user.name.$.path       // ["user", "name"]
state.user.name.$.pipe(map(it => it.length))
```

`state.user` is a signal, `state.user.name` is a signal, and `state` is the signal both write into.
Reading a path does not copy the value out; writing one does not rebuild the root by hand.

## What emits when

```
step 0  state.user.name.$("sam")
step 1  the root value becomes { user: { name: "sam" } }
step 2  state.$               emits the new root
step 3  state.user.$          emits the new user
step 4  state.user.name.$     emits "sam"
step 5  state.visits.$        stays quiet: its branch did not move
```

Step 5 is the reason to hold one object rather than a signal per field. A readout bound to
`state.visits` is not woken by a write to `state.user.name`.

## A path proxy needs an index signature

The type that walks a path gates on `Record<string, unknown>`, and an `interface` never carries an
index signature. Declare the value's shape as a type alias:

```ts
type Profile = { user: { name: string }; visits: number }   // paths walk
interface Bad { user: { name: string } }                    // paths stop at the root
```

At runtime both work, because the proxy does not read the type. The difference is whether
`state.user.name` typechecks, which is the difference that matters.
