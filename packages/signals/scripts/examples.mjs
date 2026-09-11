// The chromium pass lives in `@hafley66/docs-kit`. Signals adds only what its own peak figures
// cannot be trusted to mean.
import { fileURLToPath } from "node:url"
import { runExampleCheck } from "@hafley66/docs-kit/scripts/examples"

const root = fileURLToPath(new URL("..", import.meta.url))

const NOTE =
  "Every example here holds a handful of DOM nodes and a few subscriptions, so a peak near 0.5 MB is the measurement floor rather than a figure about the example. What the numbers are good for is the retained column: a signal whose subscription outlived its teardown shows there."

runExampleCheck({ root, paintedLabel: "reads", note: NOTE }).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
