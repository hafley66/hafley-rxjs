// pkg:budget. How many browser workers the host can carry right now. Read at config time in the
// controller and by scripts/browser-queue.mjs before it spawns a run; nothing here crosses into
// test workers. Erasable types only: node 24 strips them when the queue script imports this file.
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { availableParallelism, freemem, loadavg, platform } from "node:os"

/** A headless chromium beside a vitest worker settles near this; the number that fits is the cap. */
export const BYTES_PER_WORKER = 1.2 * 1024 ** 3

export interface WorkerBudget {
  /** Workers the host can carry now. 0 means wait: not one browser fits without swapping. */
  workers: number
  /** Bytes the kernel would hand out without paging anything active. */
  availableBytes: number
  /** `availableParallelism()` minus the one-minute load, floored at 0. */
  idleCores: number
  cores: number
}

/** `os.freemem()` on darwin counts free pages only and reads as near zero on a healthy machine, so
 *  inactive, speculative and purgeable pages are added back the way Activity Monitor does. Linux
 *  publishes the same number as MemAvailable. Any other platform gets the node figure. */
export function availableMemoryBytes(): number {
  try {
    if (platform() === "darwin") {
      const out = execFileSync("vm_stat", { encoding: "utf8" })
      const pageSize = Number(/page size of (\d+) bytes/.exec(out)?.[1] ?? 16384)
      const pages = (label: string): number => Number(new RegExp(`${label}:\\s+(\\d+)`).exec(out)?.[1] ?? 0)
      return (
        (pages("Pages free") + pages("Pages inactive") + pages("Pages speculative") + pages("Pages purgeable")) *
        pageSize
      )
    }
    if (platform() === "linux") {
      const kb = /MemAvailable:\s+(\d+) kB/.exec(readFileSync("/proc/meminfo", "utf8"))?.[1]
      if (kb !== undefined) return Number(kb) * 1024
    }
  } catch {
    // Fall through to the portable figure.
  }
  return freemem()
}

/** Memory and idle cores each set a ceiling; the lower one is the budget. Two cores per worker:
 *  one for chromium, one for the vitest worker driving it. `max` caps a quiet machine so a run never
 *  opens more browsers than half its cores whatever the memory. */
// pwp:pw-workers
export function workerBudget(options: { bytesPerWorker?: number; max?: number } = {}): WorkerBudget {
  const bytesPerWorker = options.bytesPerWorker ?? BYTES_PER_WORKER
  const cores = availableParallelism()
  const idleCores = Math.max(0, cores - loadavg()[0])
  const availableBytes = availableMemoryBytes()
  const byMemory = Math.floor(availableBytes / bytesPerWorker)
  const byCores = Math.floor(idleCores / 2)
  const max = options.max ?? 1
  // Memory is the hard wall: a browser that does not fit swaps. Load is soft: one worker still runs
  // on a busy machine, just slower, so cores floor at 1 once memory allows anything at all.
  const workers = byMemory === 0 ? 0 : Math.min(max, byMemory, Math.max(1, byCores))
  return { workers, availableBytes, idleCores, cores }
}
