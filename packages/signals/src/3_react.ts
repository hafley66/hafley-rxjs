// React integration for signals.
// SignalReact tracks reads per render and subscribes after commit.

import React from "react"
import {
  animationFrameScheduler,
  merge,
  skip,
  throttleTime,
  type Subscription,
} from "rxjs"
import { signalDispatch } from "./1_SignalCreator.js"
import type { Signal$, Signal as SignalType } from "./0_types.js"

// During a tracked render, every signal read routes here. null outside render.
let activeCollector: ((signal: SignalType<unknown>) => void) | null = null

// One global route from signal get-events to whichever render is collecting.
signalDispatch.subscribe((event) => {
  if (event.type === "get" && activeCollector) {
    activeCollector(event.value.signal as SignalType<unknown>)
  }
})

let SIGNAL_REACT_DISPLAY_ID = 0

// Wrap a component to auto-track reads during render. Each render re-derives its
// dep set; signals dropped on a later render are unsubscribed after commit.
export function SignalReact<P extends object>(Component: React.FC<P>): React.FC<P> {
  const id = SIGNAL_REACT_DISPLAY_ID++
  const displayName = `SignalReact_${id}_${Component.name || "Anonymous"}`

  const MemoizedComponent: React.FC<P> = (props) => {
    const [, force] = React.useReducer((n: number) => n + 1, 0)
    const subRef = React.useRef<Subscription | undefined>(undefined)
    const collected = React.useRef<Set<Signal$<unknown>>>(new Set())
    const subscribed = React.useRef<Set<Signal$<unknown>>>(new Set())

    // Collect this render's reads while running the component.
    collected.current = new Set()
    const previous = activeCollector
    activeCollector = (signal) => collected.current.add((signal as unknown as { $: Signal$<unknown> }).$)
    let tree: React.ReactElement
    try {
      tree = Component(props) as unknown as React.ReactElement
    } finally {
      activeCollector = previous
    }

    // After commit: replace subscriptions only when the dependency set changed.
    // A query owns its request while observed, so an unsubscribe/resubscribe on
    // every render would cancel and restart the same request indefinitely.
    React.useEffect(() => {
      const deps = collected.current
      const active = subscribed.current
      const unchanged = deps.size === active.size && [...deps].every((dependency) => active.has(dependency))
      if (unchanged) return
      subRef.current?.unsubscribe()
      subscribed.current = deps
      if (deps.size === 0) {
        subRef.current = undefined
        return
      }
      // skip(1) per accessor: BehaviorSubject emits its current value on
      // subscribe; that value is from the render just committed, not a change.
      subRef.current = merge(...[...deps].map((d) => d.pipe(skip(1)))).subscribe(() => force())
    })

    React.useEffect(() => {
      return () => {
        subRef.current?.unsubscribe()
        subRef.current = undefined
        subscribed.current = new Set()
      }
    }, [])

    return tree
  }

  MemoizedComponent.displayName = displayName
  return MemoizedComponent
}

/** @deprecated Use SignalReact. */
export const SignalReactMemo = SignalReact

/**
 * Hook to subscribe to a signal in a component. Returns current value and
 * re-renders on change.
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
export type {
  Act,
  DepthLimit,
  GetNestedValue,
  IsNullish,
  IsRecursive,
  Signal$,
  SignalCreatorOptions,
  SignalEvent,
} from "./0_types.js"
export * from "./1_SignalCreator.js"
export * from "./2_Signal.js"
export * from "./3_Endpoint.js"
export * from "./4_Query.js"
export * from "./5_Route.js"
export * from "./6_Storage.js"
export * from "./7_signalMap.js"
export * from "./8_sync.js"
export * from "./9_history.js"
