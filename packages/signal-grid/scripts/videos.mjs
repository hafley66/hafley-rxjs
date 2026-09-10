// Playwright writes .webm named after nothing a human recognises, one per attempt directory.
// This renames by test and transcodes to mp4, which is what a browser, quicktime and a pull request
// preview all play without a plugin.
//
// Run after `vitest run -c vitest.visual.config.ts`. No dependencies: node and ffmpeg only.
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const PACKAGE = fileURLToPath(new URL("..", import.meta.url))
const SOURCE = join(PACKAGE, "out/visual")
const TARGET = join(SOURCE, "mp4")
const INDEX = join(SOURCE, "index.md")

// 8_around.ts names an attempt directory `<test-slug>.<task id>.r<retry>.p<repeat>`, so the test is
// everything up to the first id segment.
const TRAILER = /\.\d+_\d+\.r\d+\.p\d+$/
const ANY_TRAILER = /\.[^.]*\.r\d+\.p\d+$/

function ffmpeg() {
  for (const candidate of ["ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
    const probe = spawnSync(candidate, ["-version"], { stdio: "ignore" })
    if (probe.status === 0) return candidate
  }
  return null
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (full.startsWith(TARGET)) continue
    const stats = statSync(full)
    if (stats.isDirectory()) walk(full, out)
    else if (name.endsWith(".webm")) out.push(full)
  }
  return out
}

function nameOf(webm) {
  const attempt = basename(dirname(webm))
  const test = attempt.replace(TRAILER, "").replace(ANY_TRAILER, "")
  const file = basename(dirname(dirname(webm)))
  return `${file}__${test}`
}

function kb(path) {
  return existsSync(path) ? Math.round(statSync(path).size / 1024) : 0
}

// One attempt directory can hold several .webm: a retry films again, and a rerun into an unclean
// out/visual leaves the previous take beside the new one. Newest wins.
function newestPerAttempt(files) {
  const best = new Map()
  for (const file of files) {
    const key = dirname(file)
    const current = best.get(key)
    if (current === undefined || statSync(file).mtimeMs > statSync(current).mtimeMs) best.set(key, file)
  }
  return [...best.values()].sort()
}

const clips = newestPerAttempt(walk(SOURCE))
if (clips.length === 0) {
  console.log(`videos: no .webm under ${relative(process.cwd(), SOURCE)}; run the visual suite first`)
  process.exit(0)
}

const bin = ffmpeg()
if (bin === null) {
  console.log("videos: ffmpeg not found on PATH or in /opt/homebrew/bin; leaving the .webm files as they are")
  for (const clip of clips) console.log(`  ${relative(PACKAGE, clip)}  ${kb(clip)} KB`)
  process.exit(0)
}

mkdirSync(TARGET, { recursive: true })
const rows = []
for (const clip of clips) {
  const name = nameOf(clip)
  const mp4 = join(TARGET, `${name}.mp4`)
  const run = spawnSync(
    bin,
    ["-y", "-loglevel", "error", "-i", clip, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4],
    { stdio: ["ignore", "inherit", "inherit"] },
  )
  if (run.status !== 0) {
    console.log(`videos: ffmpeg failed on ${relative(PACKAGE, clip)} (exit ${run.status})`)
    continue
  }
  rows.push({ name, webm: relative(PACKAGE, clip), mp4: relative(PACKAGE, mp4), webmKb: kb(clip), mp4Kb: kb(mp4) })
  console.log(`videos: ${name}.mp4  ${kb(mp4)} KB`)
}

const table = [
  "# signal-grid visual proof, recorded runs",
  "",
  `Converted by \`scripts/videos.mjs\` on ${new Date().toISOString()}.`,
  "",
  "| test | mp4 | mp4 KB | source webm | webm KB |",
  "| --- | --- | --- | --- | --- |",
  ...rows.map(r => `| ${r.name} | \`${r.mp4}\` | ${r.mp4Kb} | \`${r.webm}\` | ${r.webmKb} |`),
  "",
]
writeFileSync(INDEX, table.join("\n"))
console.log(`videos: ${rows.length} clip(s), index at ${relative(PACKAGE, INDEX)}`)
