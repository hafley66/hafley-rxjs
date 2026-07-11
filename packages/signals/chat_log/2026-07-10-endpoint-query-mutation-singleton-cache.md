# Endpoint, createQuery, and createMutation

## Result

The Signals package now includes a declarative request/response layer and flat,
recursive query/mutation Signals.

The public model is bound by two domain types:

```ts
Endpoint<Input, Output>
```

An Endpoint owns serializable request construction, response decoding, key
serialization, and a replaceable transport. The transport may execute through
window fetch, a service worker, a Chrome extension channel, a Tauri bridge, or a
test harness without changing Input/Output consumers.

Generated clients can subclass Endpoint and provide static declarative config:

```ts
class GetUser extends Endpoint<GetUserInput, User> {
  static readonly config = { request, decode, key }

  constructor(transport: EndpointTransport) {
    super(GetUser.config, transport)
  }
}
```

## Query ergonomics

`createQuery` returns the recursive Signal itself:

```ts
const query = getUser.createQuery(() => ({ id: selectedUserId.$() }))

query.data.profile.name.$()
query.error.$()
query.status.$()
query.isLoading.$()
query.isLoadingEmpty.$()
query.isStale.$()

query.refetch()
query.invalidate()
query.clear()
```

Endpoint inputs accept the same source algebra as Signal: a plain value, an
Observable, a computed function, or an existing Signal. Existing Signals retain
their identity; other sources are normalized once and exposed as `query.input`.

State is deliberately flat and denormalized:

```ts
type QueryState<T, E> = {
  data?: T
  error?: E
  status: "idle" | "loading" | "success" | "error"
  isLoading: boolean
  isLoadingEmpty: boolean
  isSuccess: boolean
  isError: boolean
  isStale: boolean
  updatedAt?: number
}
```

The implementation uses materialized request notifications and `scan`
internally. Public consumers do not pattern-match a discriminated union.

Queries are globally singleton-cached by Endpoint instance plus serialized
input. Concurrent consumers share one request and one replayed state. A key
change or refetch uses `switchMap`, cancelling the superseded request/response
cycle. There is no hidden merge concurrency.

Request ownership and cached knowledge have separate lifetimes:

- zero observers immediately cancel an in-flight request;
- the last successful state remains in the lookup entry for `cacheTime`;
- a fresh cached entry replays without fetching;
- a stale entry refetches while retaining data;
- cache expiry removes the lookup entry.

## Mutation ergonomics

`createMutation` is also a recursive flat-state Signal. Its imperative input is
itself a Signal:

```ts
const mutation = updateUser.createMutation()

mutation.input.$({ id: "1", name: "Chris" })
mutation.data.name.$()
mutation.isLoading.$()
mutation.input.$(undefined) // clear/reset
```

New mutation input switches/cancels the previous request. N+1 concurrency is
not built into this abstraction; callers who truly need it can explicitly drive
the Endpoint with a separate Signal and `mergeMap`.

## Verification

The executable contract is in:

- `src/2_Signal.overloads.test.ts`
- `src/2_Signal.memo.test.ts`
- `src/4_Query.test.ts`
- `src/4_assumptions.test.ts`

The query tests cover recursive proxy ergonomics, serializable transport,
generated Endpoint subclasses, singleton sharing, switch cancellation,
background loading with retained data, flat errors, invalidation, fresh cache
reuse, cache expiry, mutation switching, mutation recovery, and clear-on-
undefined semantics.
