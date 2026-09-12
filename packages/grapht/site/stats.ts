// `scripts/ship.mjs` regenerates stats.json with real numbers; this file only types the import so
// the theme can hand `STATS` to docsTheme and the footer strip stays fed.
import type { Stats } from "@hafley66/docs-kit"
import raw from "./stats.json"

// The import is a JSON literal, so TypeScript would infer `null` for whichever optional field
// happens to be null in today's file. The declared shape above is the contract ship.mjs writes to.
export const STATS = raw as unknown as Stats
