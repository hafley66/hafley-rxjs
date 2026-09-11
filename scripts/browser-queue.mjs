#!/usr/bin/env node
// One chromium test run at a time, machine-wide. Every lane works in its own worktree, so the only
// thing they share is the machine: N worktrees each starting a headless chromium pool means N times
// the browsers against one CPU, and every suite then times out on a machine that would have run each
// of them fine in sequence. The lock lives outside the repo for that reason, keyed by nothing, so a
// run from any worktree and a run from the primary checkout queue behind each other.
//
//   node scripts/browser-queue.mjs vitest run --config vitest.browser.config.ts
import { spawn } from "node:child_process"
import { closeSync, mkdirSync, openSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import lockfile from "proper-lockfile"

const LOCK_DIR = join(homedir(), ".cache", "hafley-rxjs")
const LOCK_FILE = join(LOCK_DIR, "chromium-tests")
// A crashed run leaves its lock behind, so the holder refreshes an mtime and a lock that stops being
// refreshed for this long is taken. Longer than the slowest suite, short enough that a wedged
// machine frees itself without a person.
const STALE_MS = 10 * 60 * 1000

const argv = process.argv.slice(2)
if (argv.length === 0) {
  console.error("usage: node scripts/browser-queue.mjs <command> [args...]")
  process.exit(2)
}

mkdirSync(LOCK_DIR, { recursive: true })
// proper-lockfile locks a path beside an existing one, so the file it keys on has to be there first.
closeSync(openSync(LOCK_FILE, "a"))

const waitedFrom = Date.now()
const release = await lockfile.lock(LOCK_FILE, {
  stale: STALE_MS,
  // Poll rather than back off: the queue should hand over as soon as the holder exits, and a lane
  // that waited through a long suite should not then wait another minute on a grown interval.
  retries: { retries: 900, factor: 1, minTimeout: 2000, maxTimeout: 2000 },
  onCompromised: (err) => {
    console.error(`browser-queue: lost the lock mid-run (${err.message})`)
  },
})
const waited = Date.now() - waitedFrom
// Silent when the lock was free, so an ordinary single run reads exactly as it did before the queue.
if (waited > 3000) console.log(`browser-queue: waited ${Math.round(waited / 1000)}s for the browser`)

// The child inherits stdio, so a queued suite reports exactly what it reports unqueued.
const child = spawn(argv[0], argv.slice(1), { stdio: "inherit", shell: false })

// A signal to the queue is a signal to the run. Releasing before the child is gone would let the
// next lane start a second chromium pool beside a dying one.
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal))

const code = await new Promise((resolve) => {
  child.on("exit", (status, signal) => resolve(signal ? 1 : (status ?? 1)))
  child.on("error", (err) => {
    console.error(`browser-queue: ${argv[0]} failed to start (${err.message})`)
    resolve(127)
  })
})
await release()
process.exit(code)
