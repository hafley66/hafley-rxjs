// The kit owns the five fields every runnable example has. This adds the one that is about signals.
import type { Example as DocsExample, ExampleCheck } from "@hafley66/docs-kit"

/** Which part of the library an example is evidence for. Every value is a word `README.md` already
 * uses: the four Signal forms, then the sections named operator, producer, slice and react. */
export type SignalForm = "state" | "source" | "computed" | "event" | "operator" | "producer" | "slice" | "react"

export interface Example extends DocsExample {
  readonly form: SignalForm
}

export type { ExampleCheck }
