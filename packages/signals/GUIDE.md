# Signal-first application architecture

Signals and RxJS own the application graph. React is the pinned renderer.

```tsx
const route = Route("/repos/:owner/:repo")
const settings = StorageSignal("instant.settings", defaults)
const worktrees = endpoint.createQuery(() => route.repo.$())

export const WorktreesPanel = SignalReact(() => (
  <TreeTable
    rows={worktrees.data.$() ?? []}
    loading={worktrees.isLoading.$()}
    compact={settings.compact.$()}
  />
))
```

## Rules

- Read Signals directly with `.$()` inside `SignalReact`; do not add a hook per value.
- Prefer inline pure computations. Name a `Signal(() => ...)` only when the domain value is reused or deserves a name.
- External state enters through producers: Route, StorageSignal, Endpoint, DOM events, and platform transports.
- Do not duplicate route, storage, request, or DOM state in React state.
- Hooks remain valid inside `SignalReact` for migration and genuinely React-local concerns, but they are not the default application architecture.
- A route value is flat. Template fields and query fields live together; only template fields are consumed into the path during navigation.
- Queries are global singleton wiring. Imperative concurrent mutation workflows remain explicit RxJS pipelines.

## React boundary

```tsx
export const Status = SignalReact(() => (
  <span className={connection.isError.$() ? "bad" : "good"}>
    {connection.status.$()}
  </span>
))
```

`SignalReact` records synchronous Signal reads during render and invalidates the component when those dependencies change. React remains responsible for component lifetime and rendering; Signals remain responsible for dataflow.
