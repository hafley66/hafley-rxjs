// One shape for every runnable example, so a docs page can iterate the registry instead of
// knowing what each example needs.
//
// `mount` returns its own teardown rather than taking an abort signal: the grid's `render()`
// already hands back a `stop()`, so a closure is the shortest thing that can carry it, and
// `scripts/examples.mjs` can call mount then teardown and measure what survived.
import type { FeatureId } from "../src/features.js"

export interface Example {
  /** Stable, kebab-case, used as an anchor. */
  readonly id: string
  readonly title: string
  /** One line: what this example demonstrates. */
  readonly summary: string
  /** The ledger id in `src/features.ts`, so a docs page can group by feature. */
  readonly feature: FeatureId
  /**
   * The example's own file text, loaded by a `?raw` self-import rather than copied by hand.
   * A copied string drifts the moment the code beside it changes; the import cannot.
   */
  readonly source: string
  /** Mounts into any host element and returns the teardown for everything it opened. */
  readonly mount: (host: HTMLElement) => () => void
}

/** What the check script reports per example. Exported so a docs page can render the same table. */
export interface ExampleCheck {
  readonly id: string
  readonly ok: boolean
  readonly failures: readonly string[]
  readonly sourceBytes: number
  readonly rowsRendered: number
  readonly nodesAfterTeardown: number
  /** Opened by a direct subscription in this package and never closed. Must be zero. */
  readonly openOwned: number
  /** Dependency subscriptions `@hafley66/signals` keeps observed for a read-pinned memo. */
  readonly retainedByDeps: number
  readonly listenerBalance: number
  readonly observerBalance: number
}
