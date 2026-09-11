// One press: measure, regenerate what is generated, build the site, and print what to open.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = join(PKG, "site", "dist")
const steps = []

const run = (label, command, args) => {
  const started = Date.now()
  try {
    execFileSync(command, args, { cwd: PKG, stdio: "inherit" })
    steps.push({ label, ok: true, ms: Date.now() - started })
    return Date.now() - started
  } catch {
    steps.push({ label, ok: false, ms: Date.now() - started })
    throw new Error(`ship: ${label} failed`)
  }
}

const bytes = (path) => (existsSync(path) ? statSync(path).size : 0)
const kb = (value) => `${(value / 1024).toFixed(1)} kB`

// One source for the public path: `site/content.ts`, which VitePress reads for its own `base`.
const contentSource = readFileSync(join(PKG, "site", "content.ts"), "utf8")
const baseMatch = /export const BASE = "([^"]+)"/.exec(contentSource)
if (baseMatch === null) throw new Error("ship: site/content.ts no longer exports a BASE string literal")
const BASE = baseMatch[1]
if (!BASE.startsWith("/") || !BASE.endsWith("/")) {
  throw new Error(`ship: BASE must start and end with "/", found ${BASE}`)
}

const SLUGS = [...contentSource.matchAll(/slug:\s*"([^"]+)"/g)].map((match) => match[1] ?? "")
if (SLUGS.length === 0) throw new Error("ship: site/content.ts declares no page slugs")

run("measure", "node", ["scripts/stats.mjs"])
const firstSiteMs = run("site (pass 1)", "pnpm", ["site:build"])
run("measure bundles", "node", ["scripts/stats.mjs", "--bundles", `--site-build-ms=${firstSiteMs}`])
run("site", "pnpm", ["site:build"])

// GitHub Pages has no rewrite rule, so a deep link only resolves when a real file sits at it.
const shell = readFileSync(join(OUT, "index.html"), "utf8")
const collided = []
for (const slug of SLUGS) {
  if (existsSync(join(OUT, slug, "index.html"))) {
    collided.push(slug)
    continue
  }
  mkdirSync(join(OUT, slug), { recursive: true })
  writeFileSync(join(OUT, slug, "index.html"), shell)
}
writeFileSync(join(OUT, "404.html"), shell)
steps.push({ label: "deep links", ok: true, ms: 0 })

const entries = () => readdirSync(OUT, { recursive: true })
const total = entries()
  .map((name) => bytes(join(OUT, String(name))))
  .reduce((sum, size) => sum + size, 0)

console.log("")
for (const step of steps) console.log(`  ${step.ok ? "ok  " : "FAIL"} ${step.label.padEnd(16)} ${step.ms} ms`)
console.log("")
console.log(`  site/dist  ${kb(total)} across ${entries().length} entries`)
console.log(`  base       ${BASE}`)
console.log(`  pages      ${SLUGS.map((slug) => `${BASE}${slug}`).join("\n             ")}`)
for (const slug of collided) {
  console.log(`  note       /${slug} is a built directory, so that deep link serves it`)
}
