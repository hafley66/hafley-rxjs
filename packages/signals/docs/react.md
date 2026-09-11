---
title: The React binding
---

# The React binding

A React component reads a signal the way any other code does, with `.$()`, in the middle of JSX,
and re-renders when that signal changes. There is no hook at the read site, no selector, no
provider, and no wrapper you have to remember to apply.

<SignalDemo id="react-tracking" height="420" />

Press **write left** and watch which render counts move. `reads left` and `reads both` go up;
`reads neither` stays where it is. Nothing in that component declared a dependency. The dependency
is the read.

## What makes it work

```ts
// vite.config.ts
import { signalsJsx } from "@hafley66/signals/vite"

export default defineConfig({
  plugins: [signalsJsx()],
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
})
```

Two lines, and every `.tsx` in the project tracks its own reads. The plugin is declared at
`src/vite-plugin.ts:6` and the whole of it is a string replacement:

```
step 0  you write        <OnlyLeft />
step 1  esbuild emits    import { jsx } from "react/jsx-runtime"
step 2  signalsJsx runs  enforce: "post", so step 1 has already happened
step 3  it rewrites      import { jsx } from "@hafley66/signals/jsx-runtime"
step 4  that jsx calls   reactJsx(track(OnlyLeft), props)
step 5  track returns    SignalReact(OnlyLeft), cached in a WeakMap per function
step 6  React sees       a stable component type, so reconciliation is unaffected
```

Step 5 is the part worth reading twice. `track` is declared at `src/4_jsxAuto.ts:8` and caches one
wrapper per function in a `WeakMap`, so the type React is handed is the same object on every
render. A wrapper minted per call would remount the subtree every time.

The last readout in the demo prints the name of whatever wraps `OnlyLeft`. With the plugin on it
reads `SignalReact_<n>_<name>`, where the name is whatever the bundler left of the function's own
(a production build renames it, so on this page it is two letters). With the plugin off it reads
`OnlyLeft`, and the buttons stop moving the render counts, which is the difference this page exists
to show.

One thing a site like this one has to get right for any of it to work. The plugin rewrites to
`@hafley66/signals/jsx-runtime`, the published specifier. If the rest of the page reaches the
library by another path, the page carries two copies, and a read tracked by one never reaches the
render collector held by the other: the counts stay at one and nothing looks broken. This site
aliases the package name onto its own `src/`, which is what `site/.vitepress/config.ts` is doing.

## What SignalReact does per render

```
render  open a collector, run the component body
  every signal read routes to the collector through signalDispatch
  close the collector, hand React the tree
commit  compare the collected set against the subscribed set
  unchanged  -> do nothing
  changed    -> unsubscribe the old set, subscribe the new one, each with skip(1)
unmount unsubscribe everything
```

The `skip(1)` is not decoration. A signal is a `BehaviorSubject`, so subscribing hands you the
current value at once, and that value is the one the render you just committed already used.
Without the skip, every subscribe would schedule a re-render, and every re-render would subscribe.

The unchanged case matters as much. A query owns its request while it is observed, so tearing down
and rebuilding the same subscription on every render would cancel and restart the same request
forever. `SignalReact` compares the dependency sets and leaves them alone when they match.

## The three ways in, and when to use which

| you write | you need | use it when |
| --- | --- | --- |
| `count.$()` in JSX | `signalsJsx()` in the vite config | always, in a project you control |
| `SignalReact(Component)` | nothing | one component, in a project without the plugin |
| `useSignal(count.$)` | nothing | you are holding an accessor rather than a signal |

`SignalReact` is the same wrapper the plugin applies, exported for a consumer who wants it on one
component rather than on all of them. `useSignal` is the older shape: it takes the accessor, holds
the latest value in React state, and throttles to one animation frame. It subscribes whether or not
the render used the value, which is the reason the other two exist.

## What does not change

A signal read in an event handler or an effect is not collected. Only render reads subscribe, which
is what keeps a click handler from quietly widening a component's dependency set.

Writes are unchanged too. `count.$(next)` from a handler is a plain synchronous write, and React
finds out about it through the subscription the last render opened.

## Where to look next

`packages/signals/DESIGN-react-binding.md` is the open design discussion the shipped behaviour came
out of, including the two proposals that were weighed and what is still open.
`src/5_jsx.jsx-e2e.test.tsx` is the suite that holds it: plain components, no wrap anywhere, run
under `vitest.jsx-e2e.config.ts` with `signalsJsx()` and nothing else.
