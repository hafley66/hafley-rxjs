# Pixi time navigator: 100k-event chaos receipt

Date: 2026-08-11

Runtime: Vitest Browser, Playwright headless Chromium, PixiJS 8.19.0, WebGL,
1440 × 900 viewport. Chromium launched with `--enable-precise-memory-info`.
Heap measurements use CDP `Performance.getMetrics` after
`HeapProfiler.collectGarbage`.

Workload:

- 100,000 deterministic dot/span marks across five lanes
- Fixed-width density buckets at overview scale
- 300 alternating horizontal-pan and cursor-anchored zoom wheel events
- 90 animation frames sampled after interaction, first five discarded
- One Pixi canvas and one canvas DOM node

| Measurement | Result |
| --- | ---: |
| Setup | 567.0 ms |
| 300 pan/zoom events | 8.4 ms |
| Frame p95 | 9.1 ms |
| Approximate p95 rate | 109.9 fps |
| Retained JS heap delta | 1.3 MB |
| JS heap after run | 26.6 MB |
| Canvas count | 1 |
| Pixi DOM descendants | 1 |

Raw receipt:

```json
{"marks":100000,"setupMs":567,"interactionMs":8.4,"frameP95Ms":9.1,"approximateFps":109.9,"heapDeltaMb":1.3,"heapUsedMb":26.6,"canvasCount":1,"pixiDomNodes":1}
```

The executable receipt is `src/2_TimeNavigator.browser.test.tsx`. Timing and
heap figures are one local run and remain machine-specific.
