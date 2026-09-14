/** The caller owns the CDP session. Works with Playwright CDPSession without a runtime dependency. */
export interface ChromiumSession {
  send(method: "Runtime.getHeapUsage" | "Memory.getDOMCounters"): Promise<unknown>
}

export interface ChromiumMemory {
  readonly source: "chromium-cdp"
  readonly jsHeapUsedBytes: number
  readonly jsHeapAllocatedBytes: number
  /** Embedder garbage-collected heap only, not all native allocations or process RSS. */
  readonly embedderHeapUsedBytes: number | undefined
  /** Array-buffer and external-string backing storage. Keep separate from the other counters. */
  readonly backingStorageBytes: number | undefined
  /** CDP target counters include text nodes and can include detached nodes, unlike host element counts. */
  readonly domNodes: number
  readonly documents: number
  readonly eventListeners: number
}

/**
 * One external sample, without forcing GC or changing page state. The caller controls cadence and GC.
 * Runtime.getHeapUsage is isolate-scoped; Memory.getDOMCounters describes the inspected target.
 * https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-getHeapUsage
 * https://chromedevtools.github.io/devtools-protocol/tot/Memory/#method-getDOMCounters
 */
export async function chromiumMemory(session: ChromiumSession): Promise<ChromiumMemory> {
  const [heap, dom] = await Promise.all([
    session.send("Runtime.getHeapUsage") as Promise<{ usedSize: number; totalSize: number; embedderHeapUsedSize?: number; backingStorageSize?: number }>,
    session.send("Memory.getDOMCounters") as Promise<{ documents: number; nodes: number; jsEventListeners: number }>,
  ])
  return {
    source: "chromium-cdp",
    jsHeapUsedBytes: heap.usedSize,
    jsHeapAllocatedBytes: heap.totalSize,
    embedderHeapUsedBytes: heap.embedderHeapUsedSize,
    backingStorageBytes: heap.backingStorageSize,
    domNodes: dom.nodes,
    documents: dom.documents,
    eventListeners: dom.jsEventListeners,
  }
}
