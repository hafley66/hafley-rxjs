// @comment-ok: the five-field contract and the "no ledger word here" rule are the two invariants this file exists to hold
// One shape for every runnable example, so a docs page can iterate a registry instead of knowing
// what each example needs. The demo panel reads exactly these five fields and nothing else, which
// is what lets one panel serve a grid package and a signals package at once.
//
// A package files its examples under its own ledger by extending this. `signal-grid` adds
// `feature`, naming a row in its parity ledger; `signals` adds `form`, naming one of the four
// Signal call shapes. Neither word belongs in this file, so neither is here.

export interface Example {
  /** Stable, kebab-case, used as an anchor. */
  readonly id: string
  readonly title: string
  /** One line: what this example demonstrates. */
  readonly summary: string
  /** The example's own file text, loaded by a `?raw` self-import rather than copied by hand. */
  readonly source: string
  /** Mounts into any host element and returns the teardown for everything it opened. */
  readonly mount: (host: HTMLElement) => () => void
}

/** What the check reports per example. Exported so a docs page can render the same table. */
export interface ExampleCheck {
  readonly id: string
  readonly ok: boolean
  readonly failures: readonly string[]
  readonly sourceBytes: number
  /** How many nodes the package's own counting selector matched while the example was mounted. */
  readonly painted: number
  readonly nodesAfterTeardown: number
  /** Opened by a direct subscription in the package under check and never closed. Must be zero. */
  readonly openOwned: number
  /** Dependency subscriptions `@hafley66/signals` keeps observed for a read-pinned memo. */
  readonly retainedByDeps: number
  readonly listenerBalance: number
  readonly observerBalance: number
}
