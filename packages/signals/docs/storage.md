---
title: Storage signals
---

# Storage signals

External state enters as a signal rather than being mirrored into a component. `localStorage` is
behind the same `.$()` and `.$(next)` a plain state signal has.

<SignalDemo id="storage-signal" />

## The shape

```ts
const note = StorageSignal("my-key", "nothing saved yet")

note.$()                 // whatever is in localStorage, or the fallback
note.$("a new note")     // writes through to localStorage
```

The fallback is what the signal holds when the key is absent or unparseable. Nothing about the
read surface says a store is behind it, which is the point: a consumer that takes a `Signal<string>`
takes this one.

## The four adapters

`StorageSignal` is `storageSignal(localStorageAdapter(key), fallback)`. The adapter is the seam, and
three others ship:

| adapter | reads from | writes with | emits on |
| --- | --- | --- | --- |
| `localStorageAdapter` | `localStorage` | `setItem` | a write, and `storage` from another tab |
| `urlAdapter` | `location.search` | `history.replaceState` | `popstate` |
| `hashAdapter` | `location.hash` | `history.replaceState` | `hashchange` and `popstate` |
| `historyAdapter` | the history entry's state | `history.replaceState` | `popstate` |

Pass one to `storageSignal` directly for the ones `StorageSignal` does not wrap:

```ts
const tab = storageSignal(urlAdapter("tab"), "overview")
```

## Serialising

`StorageOptions` carries the encode and decode pair. The default is `JSON.stringify` and
`JSON.parse`, with a failed parse falling back rather than throwing, so a key someone edited by hand
does not take the page down.

## Closing one

`storageSignal` returns a signal with a `close()` on it, because it holds a listener on the store.
`StorageSignal` returns the plain signal type; call `close()` on it when the owner of the signal goes
away, or let it live for the page.
