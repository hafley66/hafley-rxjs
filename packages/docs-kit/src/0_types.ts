// @comment-ok: the fixed-field contract and the "no ledger word here" rule are the two invariants this file exists to hold
// One shape for every runnable example, so a docs page can iterate a registry instead of knowing
// what each example needs. The demo panel reads exactly these six fields and nothing else, which
// is what lets one panel serve a grid package and a signals package at once.
//
// A package files its examples under its own ledger by extending this. `signal-grid` adds
// `feature`, naming a row in its parity ledger; `signals` adds `form`, naming one of the four
// Signal call shapes. Neither word belongs in this file, so neither is here.

/** A second way to draw the same example, brought by whichever package owns it. The label is the
 * example's to pick: a kit that spelled a framework name here would carry one in its vocabulary. */
export interface AltRenderer {
  /** What the panel prints on the button. The `mount` field's own button is always "DOM". */
  readonly label: string
  /** Same contract as `Example.source`. A panel that printed the other rendering's file would make
   * the button a claim about code the reader is not being shown, so this field is required. */
  readonly source: string
  /** Same contract as `Example.mount`: takes a host, returns the teardown for what it opened. */
  readonly mount: (host: HTMLElement) => () => void
}

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
  /** Absent on an example with one rendering, and the panel then offers no choice at all. */
  readonly alternate?: AltRenderer
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
