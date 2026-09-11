// The page half of `scripts/examples.mjs`. A grid paints rows, so a row is what counts as painted.
import { installExampleHarness } from "@hafley66/docs-kit/harness"
import { EXAMPLES } from "../index.js"

installExampleHarness({ examples: EXAMPLES, paints: "[data-route='r']" })
