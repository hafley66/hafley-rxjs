// pkg:semaphore. Machine-wide browser slot: a worker holds one of N proper-lockfile locks over
// `~/.cache/hafley-rxjs/slots/<i>` for the life of its browser. N = `semaphore.slots ?? workerBudget().workers`,
// floored at 1. The directory is the one `scripts/browser-queue.mjs` keys on, so a run-level mutex and a
// worker-level slot compose on the same machine without knowing each other. `resource$` gives the slot the
// cold resource shape (acquire -> value -> release); `browser$` subscribes it before launch and releases in
// the browser teardown. One slot per worker process, storage is the lock files only, nothing crosses `provide`.
import { closeSync, mkdirSync, openSync } from "node:fs"
import { join } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import lockfile from "proper-lockfile"
import { Observable } from "rxjs"
import type { Resource } from "./5_streams.js"
import { resource$ } from "./5_streams.js"
import { logBridge } from "./10_telemetry.js"

export interface SlotOptions {
  slots: number
  dir: string
  staleMs: number
  /** How long a worker waits for a free slot before failing. `staleMs` reclaims a dead holder's lock;
   *  this bounds the wait behind a live holder that never lets go. */
  timeoutMs: number
}
export interface Slot {
  index: number
  release: () => Promise<void>
}

/** Wait for one of `slots` lock files in `dir` and hold it. All busy: poll again every 250ms until
 *  `timeoutMs`, then fail. A worker parked here holds its whole run open — and with it the machine-wide
 *  queue lock every other lane is waiting on — so an unbounded wait is how one wedged holder stops the
 *  machine while nothing looks busy. `stale` only reclaims a lock whose holder stopped refreshing it. */
export async function acquireSlot(o: SlotOptions): Promise<Slot> {
  mkdirSync(o.dir, { recursive: true })
  const deadline = Date.now() + o.timeoutMs
  for (;;) {
    for (let i = 0; i < o.slots; i++) {
      const file = join(o.dir, String(i))
      // proper-lockfile locks a path beside an existing one, so the file it keys on has to be there first.
      closeSync(openSync(file, "a"))
      try {
        const release = await lockfile.lock(file, {
          stale: o.staleMs,
          retries: 0,
          onCompromised: err =>
            logBridge("pw-sema: slot {index} lost to another process ({error}); holding on until it frees", {
              index: i,
              error: String((err as Error)?.message ?? err),
            }),
        })
        let done = false
        return {
          index: i,
          release: async () => {
            if (done) return
            done = true
            await release()
          },
        }
      } catch (e) {
        // Locked (or raced with a release): try the next slot. A real failure surfaces on the throw.
        if ((e as NodeJS.ErrnoException)?.code !== "ELOCKED") throw e
      }
    }
    if (Date.now() >= deadline)
      throw new Error(
        `vitest-playwright: no browser slot free in ${o.dir} (${o.slots} slot${o.slots === 1 ? "" : "s"}) after ${o.timeoutMs}ms; another run is holding them`,
      )
    await sleep(250)
  }
}

/** A slot as a cold resource: `browser$` subscribes this and releases in the browser teardown after close. */
export function slot$(o: SlotOptions): Observable<Resource<Slot>> {
  return resource$(
    () => acquireSlot(o),
    async slot => {
      await slot.release()
    },
  )
}
