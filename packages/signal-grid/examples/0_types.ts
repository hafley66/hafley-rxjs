// The kit owns the five fields every runnable example has. This adds the one that is about grids:
// which row of the parity ledger the example is evidence for.
import type { AltRenderer, Example as DocsExample, ExampleCheck } from "@hafley66/docs-kit"
import type { FeatureId } from "../src/features.js"

export interface Example extends DocsExample {
  /** The ledger id in `src/features.ts`, so a docs page can group by feature. */
  readonly feature: FeatureId
}

export type { AltRenderer, ExampleCheck }
