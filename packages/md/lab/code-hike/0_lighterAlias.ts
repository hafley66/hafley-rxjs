import { createRequire } from "node:module"
import { dirname, join } from "node:path"

// lighter's `browser` export fetches every grammar and theme from https://lighter.codehike.org at
// runtime; its default build holds the same files as local lazy import() chunks. Vite picks `browser`.
const codehikeRequire = createRequire(createRequire(import.meta.url).resolve("codehike/package.json"))
const lighterDist = dirname(codehikeRequire.resolve("@code-hike/lighter/package.json"))

export const lighterLocalAlias = { "@code-hike/lighter": join(lighterDist, "dist/index.esm.mjs") }
