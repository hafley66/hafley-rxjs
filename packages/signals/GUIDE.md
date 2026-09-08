# Signal-first application architecture

Signals and RxJS own the application graph. React is the pinned renderer.

```tsx
const route = Route("/repos/:owner/:repo")
const settings = StorageSignal("instant.settings", defaults)
const worktrees = endpoint.createQuery(() => route.repo.$())

export function WorktreesPanel() { return (
  <TreeTable
    rows={worktrees.data.$() ?? []}
    loading={worktrees.isLoading.$()}
    compact={settings.compact.$()}
  />
) }
```

## Rules

- Enable `signalsJsx()` from `@hafley66/signals/vite` and read signals directly with `.$()` in plain JSX components. The interceptor applies `SignalReact` internally.
- Group related state in a signal root; use recursive paths for field projections.
- Connect cold producers through `Signal(observable)`. Tracked JSX reads own source observation; application code does not manually subscribe or wire streams with `useEffect`.
- Prefer inline pure computations. Name a `Signal(() => ...)` only when the domain value is reused or deserves a name.
- External state enters through producers: Route, StorageSignal, Endpoint, DOM events, and platform transports.
- Do not duplicate route, storage, request, or DOM state in React state.
- React-local instance allocation can remain stable without effect-based stream wiring.
- A route value is flat. Template fields and query fields live together; only template fields are consumed into the path during navigation.
- Queries are global singleton wiring. Imperative concurrent mutation workflows remain explicit RxJS pipelines.

## React boundary

```tsx
export function Status() { return (
  <span className={connection.isError.$() ? "bad" : "good"}>
    {connection.status.$()}
  </span>
) }
```

`SignalReact` records synchronous Signal reads during render and invalidates the component when those dependencies change. React remains responsible for component lifetime and rendering; Signals remain responsible for dataflow.

The shipped [signals skill](skills/signals/SKILL.md) records the complete application authoring conventions.
