# hafley-rxjs

RxJS-native state management and utilities.

## Packages

### [@hafley/signals](./packages/signals)

Reactive signals with proxy-based nested access. BehaviorSubject with ergonomics.

```ts
const state = Signal({ user: { name: "chris" } })

state.user.name.$()           // read: "chris"
state.user.name.$("new")      // write
state.user.name.$.pipe(...)   // RxJS operators
state.user.name.$.$           // meta events
```

The `$` is the BehaviorSubject. Call it to read/write. Pipe it. Subscribe to it.

```ts
// React integration
import { SignalReactMemo } from "@hafley/signals/react"

const Counter = SignalReactMemo(() => {
  return <div>{state.count.$()}</div>  // auto re-renders on change
})
```

### [@hafley/rxjs-ext](./packages/rxjs-ext)

Operators that should exist but don't.

- `repeatValue` - re-emit current value on trigger
- `makeSwitchMapCached` - switchMap with caching
- `mergeByKey` / `mergeByKeyScan` - merge preserving structure
- `combinePartialArray` / `combinePartialRecord` - combineLatest without waiting

See [rxjs-ext README](./packages/rxjs-ext/README.md) for marble diagrams.

## Install

```bash
pnpm add @hafley/signals @hafley/rxjs-ext
```

## Why

Redux is too much ceremony. Zustand/Jotai are nice until you need derived state. MobX is magic you can't debug. RxJS is powerful but verbose.

This is the intersection: proxy-based access like MobX, observable semantics like RxJS, zero ceremony like Zustand.

```ts
// 47 lines of Redux selectors + memoization + useSelector
// vs
state.user.profile.name.$()
```

## License

MIT
