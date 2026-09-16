---
"@hafley66/trace": minor
---

The frame meter moves in, and the metrics read the realm they are loaded in instead of assuming a browser.

- **`performanceReadout(target)`** was `@hafley66/docs-kit`'s, which is `private: true` — so nothing published could offer it. It now lives beside the metrics it prints and comes from `@hafley66/trace` like the rest: mount once, merge `painted$` into the runtime boundary you already have, and it samples only while that subscription lives.
- **The realm decides what the rows can say.** `metricsRealm()` reports `{ frames, heap }` for the realm the module was loaded in: `frames` needs animation-frame callbacks, `heap` needs Chromium's `performance.memory`. In node both are false, in Firefox and Safari the heap is. A surface can ask before mounting a meter at all.
- **Nothing throws where a capability is missing.** `frameStats()` and `metrics$()` complete without a sample in a realm with no animation frames rather than raising a `ReferenceError` at subscription, `memorySample()` reports `undefined` for a heap it cannot read, and the readout says which reading is unavailable and why.
- `MemorySample` and `Metrics` name what `metrics$` carries, so a consumer does not spell it out with `ReturnType`.