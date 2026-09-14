#!/usr/bin/env node
// One chromium test run at a time, machine-wide, sized to what the machine has left. Every lane
// works in its own worktree, so the only thing they share is the machine: N worktrees each starting
// a headless chromium pool means N times the browsers against one CPU, and every suite then times
// out on a machine that would have run each of them fine in sequence. The lock lives outside the
// repo for that reason, keyed by nothing, so a run from any worktree and a run from the primary
// checkout queue behind each other.
//
// Holding the lock is not the same as having room: a rustc build or a browser beside the queue can
// own the memory. So the holder waits until `workerBudget()` says one browser fits, then hands the
// run `--maxWorkers=<budget>` unless the command already pins one. The budget is the plugin's own
// (`packages/vitest-playwright/src/12_budget.ts`), imported as TypeScript: node 24 strips the types.
//
//   node scripts/browser-queue.mjs vitest run --config vitest.browser.config.ts
import { spawn } from "node:child_process"
import { closeSync, mkdirSync, openSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import lockfile from "proper-lockfile"
import { workerBudget } from "../packages/vitest-playwright/src/12_budget.ts"

const LOCK_DIR = join(homedir(), ".cache", "hafley-rxjs")
const LOCK_FILE = join(LOCK_DIR, "chromium-tests")
// A crashed run leaves its lock behind, so the holder refreshes an mtime and a lock that stops being
// refreshed for this long is taken. Longer than the slowest suite, short enough that a wedged
// machine frees itself without a person.
const STALE_MS = 10 * 60 * 1000
// How long the holder waits for memory before running with one worker anyway. A machine that stays
// full this long is being used for something else, and one slow run beats a queue that never moves.
const ROOM_WAIT_MS = 10 * 60 * 1000
const ROOM_POLL_MS = 3000
const GB = 1024 ** 3

const argv = process.argv.slice(2)
if (argv.length === 0) {
  console.error("usage: node scripts/browser-queue.mjs <command> [args...]")
  process.exit(2)
}

mkdirSync(LOCK_DIR, { recursive: true })
// proper-lockfile locks a path beside an existing one, so the file it keys on has to be there first.
closeSync(openSync(LOCK_FILE, "a"))

// A signal before the child exists has to release the lock and leave; a signal after it is the
// child's. Installing the handler at all stops node's default exit-on-signal, so the no-child case
// is spelled out or a killed waiter sits forever holding a lock it never used.
let child = null
let release = null
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (child !== null) return child.kill(signal)
    void (release === null ? Promise.resolve() : release()).finally(() => process.exit(1))
  })
}

const waitedFrom = Date.now()
release = await lockfile.lock(LOCK_FILE, {
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

// Room, not just the lock. Polled after the lock so two lanes waiting on memory do not both see the
// same gap and both start.
let budget = workerBudget()
const roomFrom = Date.now()
while (budget.workers === 0 && Date.now() - roomFrom < ROOM_WAIT_MS) {
  console.log(
    `browser-queue: ${(budget.availableBytes / GB).toFixed(1)} GB free, load leaves ${budget.idleCores.toFixed(1)} of ${budget.cores} cores; waiting for room`,
  )
  await sleep(ROOM_POLL_MS)
  budget = workerBudget()
}
const workers = Math.max(1, budget.workers)

// `--maxWorkers` is appended only to a vitest command that did not set it: vitest browser mode and
// the playwright plugin both read it, and a CLI flag outranks either config. Any other command runs
// as given.
const pinsWorkers = argv.some((arg) => /^--(max-workers|maxWorkers)(=|$)/.test(arg))
const isVitest = argv.slice(0, 2).some((arg) => /(^|\/)vitest$/.test(arg))
const command = isVitest && !pinsWorkers ? [...argv, `--maxWorkers=${workers}`] : argv
if (isVitest && !pinsWorkers)
  console.log(
    `browser-queue: ${workers} worker${workers === 1 ? "" : "s"} (${(budget.availableBytes / GB).toFixed(1)} GB free, ${budget.idleCores.toFixed(1)} idle of ${budget.cores} cores)`,
  )

// The child inherits stdio, so a queued suite reports exactly what it reports unqueued. A signal to
// the queue is a signal to the run (handler above): releasing before the child is gone would let
// the next lane start a second chromium pool beside a dying one.
child = spawn(command[0], command.slice(1), { stdio: "inherit", shell: false })

const code = await new Promise((resolve) => {
  child.on("exit", (status, signal) => resolve(signal ? 1 : (status ?? 1)))
  child.on("error", (err) => {
    console.error(`browser-queue: ${argv[0]} failed to start (${err.message})`)
    resolve(127)
  })
})
await release()
process.exit(code)
