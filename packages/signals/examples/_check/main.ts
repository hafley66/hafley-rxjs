// The page half of `scripts/examples.mjs`. A signals example paints readouts, so a readout is what
// counts as painted.
import { installExampleHarness } from "@hafley66/docs-kit/harness"
import { EXAMPLES } from "../index.js"

installExampleHarness({ examples: EXAMPLES, paints: "[data-read]" })
