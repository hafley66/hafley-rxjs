/**
 * React integration for signals.
 *
 * Import from "@hafley/signals/react" to get:
 * - SignalReactMemo: auto-tracking component wrapper (like mobx observer)
 * - useSignal: hook to subscribe to a signal in a component
 */

import React from "react"
import {
  exhaustMap,
  filter,
  map,
  mergeMap,
  scan,
  shareReplay,
  Subject,
  takeUntil,
  throttleTime,
  animationFrameScheduler,
} from "rxjs"
import { signalDispatch } from "./1_SignalCreator.js"
import type { Signal, Signal$ } from "./0_types.js"

/**
 * Internal: wraps a function to track signal reads during execution.
 */
function memoWrap<T>(fun: (...args: unknown[]) => T) {
  const start = new Subject<void>()
  const end = new Subject<void>()

  const watchFun = (...args: unknown[]) => {
    start.next()
    try {
      return fun(...args)
    } finally {
      end.next()
    }
  }

  const watcher$ = start.pipe(
    exhaustMap(() =>
      signalDispatch.pipe(
        filter((i) => i.type === "get"),
        takeUntil(end),
      )
    ),
    scan(
      (found, next) => {
        if (found.all.find((i) => i === next.value.signal)) {
          return { all: found.all, next: null }
        }
        const all = found.all.concat([next.value.signal])
        return { all, next: next.value.signal }
      },
      { next: null, all: [] } as { next: Signal<unknown> | null; all: Signal<unknown>[] }
    ),
    filter((i) => !!i.next),
    mergeMap((i) =>
      i.next!.$.pipe(
        map((n, index) => ({
          index,
          value: n,
          signal: i.next,
        }))
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  )

  return { fun: watchFun, watcher$ }
}

let SIGNAL_REACT_DISPLAY_ID = 0

/**
 * Wrap a React component to auto-track signal dependencies.
 * Like mobx's `observer()` - reads to `.$()` during render
 * are tracked and trigger re-renders on change.
 *
 * @example
 * ```tsx
 * const state = Signal({ count: 0 })
 *
 * const Counter = SignalReactMemo((props) => {
 *   return <div>Count: {state.count.$()}</div>
 * })
 *
 * // Component re-renders when state.count changes
 * state.count.$(1)
 * ```
 */
export function SignalReact<P extends object>(
  Component: React.FC<P>
): React.FC<P> {
  const id = SIGNAL_REACT_DISPLAY_ID++
  const displayName = `SignalReactMemo_${id}_${Component.name || "Anonymous"}`

  const MemoizedComponent: React.FC<P> = (props) => {
    const [, forceRender] = React.useState(0)

    const watcher = React.useMemo(() => {
      const memo = memoWrap(Component as (props: P) => React.ReactNode)
      return {
        ...memo,
        sub: memo.watcher$
          .pipe(
            throttleTime(16, animationFrameScheduler, { leading: true, trailing: true }),
            map((_, index) => {
              forceRender(index)
              return index
            }),
          )
          .subscribe(),
      }
    }, [])

    React.useEffect(() => {
      return () => {
        watcher.sub.unsubscribe()
      }
    }, [watcher])

    return watcher.fun(props) as React.ReactElement
  }

  MemoizedComponent.displayName = displayName
  return MemoizedComponent
}

/** @deprecated Use SignalReact. */
export const SignalReactMemo = SignalReact

/**
 * Hook to subscribe to a signal in a React component.
 * Returns current value and re-renders on change.
 *
 * @example
 * ```tsx
 * const state = Signal({ name: "chris" })
 *
 * function MyComponent() {
 *   const name = useSignal(state.name.$)
 *   return <div>{name}</div>
 * }
 * ```
 */
export function useSignal<T>(signal$: Signal$<T>): T {
  const [value, setValue] = React.useState(() => signal$.value)

  React.useEffect(() => {
    const sub = signal$
      .pipe(
        throttleTime(16, animationFrameScheduler, { leading: true, trailing: true }),
      )
      .subscribe(setValue)

    return () => sub.unsubscribe()
  }, [signal$])

  return value
}

// Re-export everything from main + react-specific
export * from "./0_types.js"
export * from "./1_SignalCreator.js"
export * from "./2_Signal.js"
