---
title: Computed
---

# Computed

`Signal(() => ...)` runs the body, caches the result, and re-runs it when a signal the body read
changes. The dependency set is whatever the last run actually read, so a branch changes it.

<SignalDemo id="computed-thunk" />

## Dependencies come from the run, not from a list

```ts
const chosen = Signal(() => (reading.$() === "left" ? left.$() : right.$()))
```

While `reading` holds `"left"`, that body reads `reading` and `left`. Writing `right` does nothing,
because nothing read it.

```
step 0  reading="left"      body runs   reads reading, left     deps = {reading, left}
step 1  right.$(101)        no run                              nothing read right
step 2  left.$(2)           body runs   reads reading, left     deps unchanged
step 3  reading.$("right")  body runs   reads reading, right    deps = {reading, right}
step 4  left.$(3)           no run                              left is no longer read
step 5  right.$(102)        body runs                           it is now
```

Steps 1 and 4 are the point. The run count in the demo above is the number that shows it: press
the other button and watch which writes move it.

## Lazy and cached

The body does not run until something reads the signal. After it runs, `.$()` returns the cached
value until a dependency moves. A computed nobody reads costs nothing.

## Naming one

`createComputedSignal(fn)` numbers its memos `memo#1`, `memo#2` and so on for the log. Pass a name
to make a record traceable to a call site:

```ts
const sorted = createComputedSignal(() => [...rows.$()].sort(byName), "sorted")
```
