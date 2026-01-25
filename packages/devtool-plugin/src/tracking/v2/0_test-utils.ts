/**
 * Common test setup utilities
 *
 * Note: Observable patching is done at compile time via Vite plugin.
 * patchObservable is idempotent so safe if called multiple times.
 */

import { afterEach, beforeEach } from "vitest"
import { main } from "./0_store"

type TestSetupOptions = {
  fakeTrack?: boolean
  cleanup?: () => void
}

/**
 * Standard test setup. Resets state, enables tracking, sets time to 0.
 */
export function useTrackingTestSetup(opts: TestSetupOptions | boolean = {}) {
  const { fakeTrack = false, cleanup } = typeof opts === "boolean" ? { fakeTrack: opts } : opts
  let sub: any
  beforeEach(() => {
    sub = main.state$$.subscribe()
    main.reset()
    main.setNow(0)
    expect(main.state$.value).toEqual(main.state$.initialValue)
    main.emit({ type: "enable" })
    if (fakeTrack) {
      main.emit({ type: "hmr-module-call", url: "0_test-utils.ts", id: "test" })
    }
  })

  afterEach(() => {
    main.setNow(null)
    main.state$.reset()
    sub?.unsubcribe?.()
    cleanup?.()
  })
}
