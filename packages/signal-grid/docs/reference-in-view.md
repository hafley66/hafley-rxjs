# runWhenInView

Every subscription a demo needs, opened when a reader can see the demo and closed when they cannot.
A docs page carrying twenty-four grids costs what is on screen rather than what was mounted.

`src/17_in_view.ts` is the whole of it.

```ts
import { mountInView, runWhenInView } from "@hafley66/signal-grid"

export const example = {
  mount: (host: HTMLElement) => mountInView(host, () => {
    const g = grid<Row>({ id: "files", rows: ROWS, columns: COLUMNS, rowId: (it) => it.id })
    const handle = render(g, root)
    const counted$ = g.view.plan.$.pipe(
      tap((plan) => {
        label.textContent = `${plan.center.length} rows in the document`
      }),
    )
    const stop = runWhenInView(counted$)
    return () => {
      stop()
      handle.stop()
      g.close()
    }
  }),
}
```

## The two calls

| call | what it does |
| --- | --- |
| `mountInView(host, mount)` | binds `host` for the length of `mount`, returns what `mount` returned |
| `runWhenInView(source)` | subscribes while the host is in view, returns the teardown |

The host is bound rather than passed, so the call inside a demo carries a source and nothing else.
The binding lasts one synchronous mount call and is restored on the way out, which is why two demos
on one page never read each other's host. A `runWhenInView` with nothing bound throws and names
`mountInView` rather than guessing an element.

## What it accepts

One argument, and it carries the effect.

| shape | example |
| --- | --- |
| `Signal<T>` | `g.state.sort` |
| `Observable<T>` | `g.view.plan.$`, `g.intent$`, `fromEvent(button, "click")` |

A thunk and a bare value are both refused. A constant emits once and never again, and a thunk has
nowhere to put a `tap`, which is where an effect belongs. Writing `source.pipe(tap(...))` is the
whole of it: a call site that wanted a callback here was assembled forwards from its input rather
than backwards from its output.

## The edge it watches

One `IntersectionObserver` serves the whole page, held by the `MeasureStore` in `src/14_measure.ts`
with the `rootMargin` buffer that reports an entry before it is visible. Work starts while the demo
is still under the fold, so the first frame a reader sees is already current. Teardown releases the
host from that observer, and the last teardown disconnects it.

A host removed from the document reports as leaving on the same observer, so a demo torn down by its
own page needs no second watcher.

## Leaving and returning

Returning re-subscribes. An interval restarts, a signal replays its current value, a listener
re-attaches. A value a later click depends on belongs in a derivation rather than in a variable the
effect writes: see the page count in `examples/9_pagination.ts`, which reads
`g.view.plan.$().pageCount` on demand so the stepper's bound holds whether or not the label painted.
