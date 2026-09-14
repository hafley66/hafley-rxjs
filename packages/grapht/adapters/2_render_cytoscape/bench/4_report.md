# Renderer resident memory and frame delivery, 2026-09-13

Renderer PID RSS is near parity at 8,000 messages in this sequence workload. Median RSS also nearly matches at 12,000. The sampled ordering reverses again at 14,000 and 16,000; trial variation and nonmonotonic values do not support one stable break-even limit.

## Total resident renderer PID memory

Median MiB, three fresh-browser trials per renderer/size. Ranges show minimum–maximum. OS RSS includes resident JavaScript and native pages.

| Messages | Document RSS | Cytoscape RSS | Document range | Cytoscape range | Document host elements | Cyto host elements |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 125 | 109.6 | 172.9 | 109.4–109.8 | 172.2–173.2 | 595 | 72 |
| 1,000 | 146.6 | 202.6 | 146.1–148.0 | 186.9–203.2 | 4,186 | 72 |
| 4,000 | 226.7 | 280.8 | 222.5–243.0 | 279.5–282.6 | 16,498 | 72 |
| 8,000 | 355.3 | 351.6 | 355.1–356.8 | 350.2–370.3 | 32,914 | 72 |
| 12,000 | 479.2 | 477.6 | 477.3–480.3 | 443.5–502.7 | 49,330 | 72 |
| 14,000 | 536.8 | 552.7 | 535.3–539.4 | 503.9–555.4 | 57,538 | 72 |
| 16,000 | 593.1 | 554.8 | 587.4–593.4 | 542.8–556.8 | 65,746 | 72 |

The harness discovers real OS PIDs using browser CDP `SystemInfo.getProcessInfo` and passes them to `@hafley66/trace/node` processMemory. Each fresh browser reported exactly one renderer PID. Raw results also retain browser, GPU-process, and network-process RSS. GPU-process RSS is not GPU device memory. Cross-process RSS sums can double-count shared pages.

## Pan and zoom frame delivery

Median of two trials, three-second windows via trace lag$("raf", 3000). Headless Chromium on this machine delivered approximately 120 callbacks/s at small sizes. Values measure callback delivery, not displayed frames.

| Messages | Document pan FPS | Cyto pan FPS | Document zoom FPS | Cyto zoom FPS |
| ---: | ---: | ---: | ---: | ---: |
| 125 | 118.9 | 119.1 | 117.8 | 118.5 |
| 1,000 | 117.7 | 119.8 | 112.2 | 119.5 |
| 4,000 | 29.3 | 57.8 | 28.1 | 59.1 |
| 16,000 | 7.5 | 16.1 | 7.3 | 16.7 |

Input is a synthetic wheel event every 16 ms, reversing every 500 ms. Pan uses 8 px/event and Ctrl-wheel zoom uses 2 px/event. Heavy rendering delays the input timer too; the raw events count exposes reduced delivery, so these trials do not establish throughput under identical delivered input counts. Each mode/size/trial uses a fresh browser; pan precedes zoom in that browser. Camera scale starts at 0.3 in a 1280×800 viewport. Most content in larger scenes is outside the viewport. These are exploratory local measurements; unrelated machine activity was not controlled.

## Reproduction and scope

The same 125-message sequence is repeated vertically in one graph, scaling actors/groups too. Both renderers retain the same source graph and SVG string. Full artifact DOM is mounted only in document mode. Browser: Chromium 151.0.7922.34. Source: 0b2f313 with this working-tree trace/benchmark integration.

RSS is sampled after renderer mount, two animation frames and forced GC. It is a mounted sample, not peak RSS during motion. Heap and resident measurements are distinct. Runtime.getHeapUsage additionally records JS heap, embedder GC heap, and backing storage; these components are not labelled total resident memory.

From repository root:

```sh
pnpm --filter @hafley66/trace build
COPIES=1,8,32,64,96,112,128 TRIALS=3 OUT=/private/tmp/grapht-rss.json node packages/grapht/adapters/2_render_cytoscape/bench/2_memory.mjs
node packages/grapht/adapters/2_render_cytoscape/bench/5_frames.mjs
```

Raw measurements: [RSS and heap breakdowns](./7_rss.json), [trace frame windows](./6_frames.json). Collector: [trace processMemory](../../../../trace/src/10_processMemory.ts).

## Earlier JS-heap-only experiment

No JavaScript heap crossover observed across 125 to 16,000 messages. Cytoscape uses more at every sampled size; the absolute gap increases. These samples do not establish a crossover outside the tested range.

| Messages | Document MiB | Cytoscape MiB | Document DOM elements | Cytoscape DOM elements |
| ---: | ---: | ---: | ---: | ---: |
| 125 | 2.23 | 6.84 | 595 | 72 |
| 250 | 2.31 | 9.21 | 1,108 | 72 |
| 500 | 2.45 | 13.57 | 2,134 | 72 |
| 1,000 | 2.69 | 22.42 | 4,186 | 72 |
| 2,000 | 3.23 | 40.05 | 8,290 | 72 |
| 4,000 | 4.31 | 75.18 | 16,498 | 72 |
| 8,000 | 6.40 | 145.50 | 32,914 | 72 |
| 16,000 | 10.63 | 286.21 | 65,746 | 72 |

## Method

- Source revision: `39a8176`, with the benchmark files in this directory added locally.
- Chromium 151.0.7922.34, headless, viewport 1280 by 800. Three fresh browser processes per renderer and size, alternating renderer order between trials.
- Production Vite build. Each page imports only the selected renderer entry point and common fixture code.
- Repeat the checked 125-message sequence 1, 2, 4, 8, 16, 32, 64, or 128 times vertically within one graph and one SVG artifact. Actor and group counts also scale. This measures this sequence workload, not arbitrary graph topology.
- Same input graph and artifact retained by each renderer. Fixed camera scale 0.3: larger scenes extend beyond the viewport. All graph entities remain mounted.
- Force GC through CDP `HeapProfiler.collectGarbage` at each phase. Read `JSHeapUsedSize` using `Performance.getMetrics`. Mounted values above are medians after two animation frames and GC, including imported library code and retained input.
- Validate graph entity count = 148 × copies + 1, native Cytoscape message edges = 125 × copies, and host DOM element counts = 513 × copies + 82 for document and 72 for Cytoscape. All 48 recorded trials pass.
- Raw results include imported, prepared, mounted, rendererDelta (mounted minus prepared), and released byte counts. `mountAndMeasureMs` includes synchronization, GC, and teardown; it is not a renderer timing benchmark. Released samples occur immediately after unsubscribe and do not establish a leak.

## Metric limits

This measures JavaScript heap only. Native DOM storage, GPU allocations, and total browser process memory are outside this metric. DOM element counts measure quantity, not bytes. These results cannot establish total-memory break-even or attribute the difference to browser DOM optimization.

## Reproduce

From repository root:

```sh
COPIES=1,2,4,8,16,32,64,128 TRIALS=3 OUT=/private/tmp/grapht-memory.json node packages/grapht/adapters/2_render_cytoscape/bench/2_memory.mjs
```

Harness: [2_memory.mjs](./2_memory.mjs). Fixture: [0_fixture.ts](./0_fixture.ts). Raw measurements: [3_results.json](./3_results.json).

CDP references: [Performance.getMetrics](https://chromedevtools.github.io/devtools-protocol/tot/Performance/#method-getMetrics), [HeapProfiler.collectGarbage](https://chromedevtools.github.io/devtools-protocol/tot/HeapProfiler/#method-collectGarbage).
