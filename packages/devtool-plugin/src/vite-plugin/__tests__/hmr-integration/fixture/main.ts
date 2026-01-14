import { BehaviorSubject } from "rxjs"

// This file will be transformed by our plugin to wrap with __$

// HMR_MARKER: v1
const initialValue = 10

// Just a raw BehaviorSubject, no pipe
const source$ = new BehaviorSubject(initialValue)

// Expose to window for test access
declare global {
  interface Window {
    __test__: {
      source$: typeof source$
      values: number[]
      subscription: ReturnType<typeof source$.subscribe> | null
      hmrCount: number
    }
  }
}

// Initialize or preserve test state across HMR
if (!window.__test__) {
  // First load - store the stable wrapper reference
  window.__test__ = {
    source$,  // This is the stable wrapper, keep it forever
    values: [],
    subscription: null,
    hmrCount: 0,
  }
}

window.__test__.hmrCount++

// On first load, set up subscription
// On HMR reload, the subscription should survive via trackedBehaviorSubject swap
if (!window.__test__.subscription) {
  window.__test__.subscription = window.__test__.source$.subscribe(v => {
    window.__test__.values.push(v)
    document.getElementById("output")!.textContent = window.__test__.values.join(", ")
  })
}

// NOTE: We do NOT update window.__test__.source$ on HMR!
// The stable wrapper switches its inner source automatically.
// The test continues using the original stable wrapper reference.

console.log("[main.ts] loaded, hmrCount:", window.__test__.hmrCount)
