// One press: measure, regenerate what is generated, build the site, fold the demo and the
// recordings into it, and print what a reviewer should open.
import { execFileSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
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

// One source for the public path: `site/content.ts`, which VitePress reads for its own `base`. A
// ship that guessed it would put the demo under a prefix the site does not link to.
const configSource = readFileSync(join(PKG, "site", "content.ts"), "utf8")
const baseMatch = /export const BASE = "([^"]+)"/.exec(configSource)
if (baseMatch === null) throw new Error("ship: site/content.ts no longer exports a BASE string literal")
const BASE = baseMatch[1]
if (!BASE.startsWith("/") || !BASE.endsWith("/")) throw new Error(`ship: BASE must start and end with "/", found ${BASE}`)

const contentSource = readFileSync(join(PKG, "site", "content.ts"), "utf8")
const SLUGS = [...contentSource.matchAll(/slug:\s*"([^"]+)"/g)].map((match) => match[1] ?? "")
if (SLUGS.length === 0) throw new Error("ship: site/content.ts declares no page slugs")

const mp4 = join(PKG, "out", "visual", "mp4")

/** Recordings live outside the build, so every pass that empties `dist` has to fold them back in. */
function copyVideos() {
  if (!existsSync(mp4)) return 0
  const videos = join(OUT, "videos")
  rmSync(videos, { recursive: true, force: true })
  mkdirSync(videos, { recursive: true })
  let copied = 0
  for (const name of readdirSync(mp4)) {
    if (!name.endsWith(".mp4")) continue
    cpSync(join(mp4, name), join(videos, name))
    copied++
  }
  return copied
}

// VitePress owns the site build, and `site:build` runs the content copy that feeds it first.
const buildSite = (label) => run(label, "pnpm", ["site:build"])
// Into the site's own tree so one directory is the whole artifact and relative links resolve.
const buildDemo = (label) =>
  run(label, "npx", [
    "vite",
    "build",
    "-c",
    "demo/vite.config.ts",
    "--base",
    `${BASE}demo/`,
    "--outDir",
    join(OUT, "demo"),
    "--emptyOutDir",
  ])

// The live factor page, into the same tree for the same reason. `bench/scroll/vite.config.ts`
// already sets a relative base, so it resolves under any prefix Pages serves.
const buildBench = (label) =>
  run(label, "npx", [
    "vite",
    "build",
    "-c",
    "bench/scroll/vite.config.ts",
    "--outDir",
    join(OUT, "bench"),
    "--emptyOutDir",
  ])

// The parity matrix is generated from source tags, so a stale one is a doc that lies.
run("parity matrix", "node", ["scripts/parity.mjs"])
run("measure", "node", ["scripts/stats.mjs"])

const firstSiteMs = buildSite("site (pass 1)")
const firstDemoMs = buildDemo("demo (pass 1)")
copyVideos()

// The site imports stats.json, so its own weight is only knowable once it has been built. Measure
// the first pass, then rebuild so the shipped page carries the measurement.
run("measure bundles", "node", [
  "scripts/stats.mjs",
  "--bundles",
  `--site-build-ms=${firstSiteMs}`,
  `--demo-build-ms=${firstDemoMs}`,
])

buildSite("site")
buildDemo("demo")
buildBench("bench")
const copied = copyVideos()

// GitHub Pages has no rewrite rule, so a deep link only resolves when a real file sits at it. One
// copy of the shell per slug is what makes `/parity` load the shell that then renders `/parity`.
const shell = readFileSync(join(OUT, "index.html"), "utf8")
const collided = []
for (const slug of SLUGS) {
  // A slug that names a directory the demo build owns must not have its index.html overwritten.
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
console.log(`  ok   videos           ${copied} copied`)
console.log("")
console.log(`  site/dist  ${kb(total)} across ${entries().length} entries`)
console.log(`  base       ${BASE}`)
console.log(`  pages      ${SLUGS.map((slug) => `${BASE}${slug}`).join("\n             ")}`)
console.log(`  demo       ${BASE}demo/`)
console.log(`  bench      ${BASE}bench/gallery.html`)
console.log(`  open       npx vite preview -c site/vite.config.ts`)
if (copied === 0) console.log(`  note       no recordings in out/visual/mp4; run \`pnpm test:visual && pnpm videos\``)
for (const slug of collided) {
  console.log(`  note       /${slug} is a built directory, so that deep link serves it; the doc page is reached through the nav`)
}
