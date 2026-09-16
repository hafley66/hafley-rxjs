// Declarations must not name asset files. `tsc` keeps `import "./2_marbler.css"` out of a module's
// declarations, and a consumer resolving the published types under node16 has no rule that accepts a
// `.css` specifier, so the import would fail for them. The JavaScript keeps the import: bundlers
// resolve the asset, and that is how this package delivers its stylesheet.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"

const assets = /^\s*import\s+["'][^"']+\.(css|svg|png|jpe?g|gif|webp|avif|woff2?|ttf|eot)["'];?\s*$\n?/gm
const outDir = new URL("../dist", import.meta.url)
const stripped = []

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (entry.name.endsWith(".d.ts")) {
      const source = readFileSync(path, "utf8")
      const next = source.replace(assets, "")
      if (next !== source) {
        writeFileSync(path, next)
        stripped.push(path)
      }
    }
  }
}

if (existsSync(outDir)) walk(outDir.pathname)
console.log(`stripped asset imports from ${stripped.length} declaration files`)
