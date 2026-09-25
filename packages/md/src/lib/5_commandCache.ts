// Fence-command results are memoized at module scope: a remount or a second
// pane reading the same fence must not rerun a host formatter, and while a run
// is in flight every consumer shares the single host process. The runner stays
// cold at the cache boundary — when the last consumer unsubscribes before an
// answer lands, the host process is told to stop.
//
// The store is `lru-cache` (max 200) instead of a hand-rolled eviction map.
// The bucket key hashes the text, so a hit is only trusted after comparing the
// full stored text; on a hash collision the answer is re-run.
import { LRUCache } from "lru-cache";
import { Observable, ReplaySubject, of, share, take, tap } from "rxjs";
import type { MdFenceCommandRequest, MdFenceCommandResult, MdFenceCommandRunner } from "../plugins/0_types.js";

/** Bounded so a long session cannot accumulate every document ever formatted. */
const CACHE_LIMIT = 200;

interface CacheEntry {
  text: string;
  /** The run's answer once it landed; settled hits replay it without the host. */
  result?: MdFenceCommandResult;
  /** The shared run while in flight; late consumers may also replay from it. */
  shared: Observable<MdFenceCommandResult>;
}

const cache = new LRUCache<string, CacheEntry>({ max: CACHE_LIMIT });

// FNV-1a 32-bit: the text only needs a stable bucket key, not cryptography.
function hash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function keyOf(request: MdFenceCommandRequest): string {
  return `${request.command}\u0000${request.language}\u0000${request.columns}\u0000${hash(request.text)}`;
}

/** Wraps a runner with the module-level result cache and in-flight sharing. */
export function cachedFenceCommandRunner(run: MdFenceCommandRunner): MdFenceCommandRunner {
  return (request) => {
    const key = keyOf(request);
    const hit = cache.get(key);
    if (hit?.text === request.text && hit.result !== undefined) return of(hit.result);
    if (hit?.text === request.text) return hit.shared;
    // The subject survives completed runs (resetOnComplete: false) but is torn
    // down with the source when the last consumer walks away mid-flight
    // (resetOnRefCountZero: true), so unsubscribing still stops the host.
    // `take(1)` consumers unsubscribe between the answer and the source's own
    // completion, which resets even a finished subject — the recorded
    // `entry.result` is what makes settled answers replayable regardless.
    const entry: CacheEntry = {
      text: request.text,
      shared: run(request).pipe(
        take(1),
        tap({ next: (result) => { entry.result = result; } }),
        share({
          connector: () => new ReplaySubject<MdFenceCommandResult>(1),
          resetOnComplete: false,
          resetOnError: true,
          resetOnRefCountZero: true,
        }),
      ),
    };
    cache.set(key, entry);
    return entry.shared;
  };
}
