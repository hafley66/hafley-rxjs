# Pixi retained temporal renderer: 10-second receipt

Date: 2026-08-11

Runtime: Vitest Browser, headless Chromium, PixiJS 8.19.0, WebGL preference,
1440 × 900 browser viewport, 1200 × 600 renderer.

Workload:

- Source interval: 10 ms
- Events requested per source change: 10
- Phases retained per event: 4
- Lanes: 80
- Each source change appends one retained `Graphics` batch
- Camera scale and translation change before each rendered frame
- `auditTime(0, animationFrameScheduler)` coalesces source changes

Results:

| Measurement | Result |
| --- | ---: |
| Elapsed | 10.0176 s |
| Requested changes | 951 |
| Requested change rate | 94.9329 Hz |
| Actual renders | 834 |
| Actual render rate | 83.2535 Hz |
| Coalesced changes | 117 |
| Coalescing ratio | 12.3028% |
| Appended events | 9,510 |
| Event append rate | 949.3292 events/s |
| Appended phases | 38,040 |
| Phase append rate | 3,797.3167 phases/s |
| Retained graphics batches | 951 |
| Average events per render | 11.4029 |
| Average phases per render | 45.6115 |
| Average draw time | 1.1436 ms |
| Median draw time | 1.0000 ms |
| p95 draw time | 2.2000 ms |
| Maximum draw time | 21.8000 ms |
| Total draw time | 953.8000 ms |
| Draw duty cycle | 9.5212% |

Raw receipt:

```json
{"elapsedSeconds":10.017599999904633,"requestedChanges":951,"requestedChangeRateHz":94.93291806511075,"actualRenders":834,"actualRenderRateHz":83.25347388675328,"coalescedChanges":117,"coalescingRatio":0.12302839116719244,"appendedEvents":9510,"eventRatePerSecond":949.3291806511075,"appendedPhases":38040,"phaseRatePerSecond":3797.31672260443,"retainedBatches":951,"averageEventsPerRender":11.402877697841726,"averagePhasesPerRender":45.611510791366904,"averageDrawMs":1.143645082446311,"p50DrawMs":1,"p95DrawMs":2.200000047683716,"maxDrawMs":21.799999952316284,"totalDrawMs":953.7999987602234,"drawDutyCycle":0.09521242600715776}
```

The measurement is one run on the current machine. It establishes this fixture's
observed counts and timings; it is not a cross-device performance claim.
