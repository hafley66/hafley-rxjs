# Renderer breakpoint sweep

Deterministic grid topology. x=node count. Time fields are browser/native renderer timings. RSS is the sampled renderer process tree. Hard break means crash, OOM, timeout, device loss, allocation failure, or renderer error. Soft thresholds remain healthy rows.

| renderer | highest healthy | first soft threshold | first harness failure | first confirmed renderer failure |
| --- | ---: | ---: | ---: | ---: |
| cytoscape | 5000 nodes | 10000 nodes (interactionP95>100ms) | 250000 nodes (runner-timeout: isolated renderer worker exceeded 45000ms) | none observed |
| canvaskit | 25000 nodes | 50000 nodes (interactionP95>100ms) | none observed | none observed |
| sigma | 1000 nodes | 5000 nodes (interactionP95>100ms) | none observed | none observed |
| vello-wgpu | 250000 nodes | 500000 nodes (interactionP95>100ms) | none observed | 1000000 nodes (renderer-error: wgpu error: Validation Error Caused by: In Device::create_bind_group Buffer binding 1 range 268435456 exceeds `max_*_buffer_binding_size` limit 134217728 note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace) |

| renderer | nodes | edges | first render ms | interaction p95 ms | peak RSS MiB | status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| cytoscape | 1000 | 1936 | 89.59999990463257 | 16.5 | 908.48 | healthy |
| cytoscape | 5000 | 9858 | 338.7999999523163 | 79.5 | 1142.34 | healthy |
| cytoscape | 10000 | 19800 | 648.7000000476837 | 163.10000014305115 | 1348.44 | soft-threshold |
| cytoscape | 25000 | 49683 | 1592.3000001907349 | 378.80000019073486 | 1917.31 | soft-threshold |
| cytoscape | 50000 | 99552 | 3112.5999999046326 | 819 | 2872.77 | soft-threshold |
| cytoscape | 100000 | 199367 | 6483.599999904633 | 1548.5 | 3810.88 | soft-threshold |
| cytoscape | 250000 |  |  |  | 4711.55 | runner-timeout |
| canvaskit | 1000 | 1936 | 14.100000143051147 | 8.799999952316284 | 588.47 | healthy |
| canvaskit | 5000 | 9858 | 25.700000047683716 | 19 | 647.45 | healthy |
| canvaskit | 10000 | 19800 | 39.200000047683716 | 31.700000047683716 | 807.66 | healthy |
| canvaskit | 25000 | 49683 | 63.89999985694885 | 57.200000047683716 | 803.02 | healthy |
| canvaskit | 50000 | 99552 | 105.90000009536743 | 102.20000004768372 | 821.95 | soft-threshold |
| canvaskit | 100000 | 199367 | 190.90000009536743 | 191.5 | 831.55 | soft-threshold |
| canvaskit | 250000 | 499000 | 446 | 452.39999985694885 | 920.20 | soft-threshold |
| canvaskit | 500000 | 998585 | 791.1999998092651 | 811.1000001430511 | 1024.94 | soft-threshold |
| canvaskit | 1000000 | 1998000 | 1520.5999999046326 | 1598.9000000953674 | 1244.69 | soft-threshold |
| canvaskit | 2000000 | 3997171 | 3058.4000000953674 | 3149.9000000953674 | 1559.56 | soft-threshold |
| sigma | 1000 | 1936 | 273.39999985694885 | 77 | 985.72 | healthy |
| sigma | 5000 | 9858 | 839 | 390.7999999523163 | 1108.22 | soft-threshold |
| sigma | 10000 | 19800 | 1568.6999998092651 | 731.5 | 1191.72 | soft-threshold |
| sigma | 25000 | 49683 | 3508.199999809265 | 1726.5 | 1177.72 | soft-threshold |
| sigma | 50000 | 99552 | 6709.800000190735 | 3433.7000000476837 | 1261.42 | soft-threshold |
| sigma | 100000 | 199367 | 14493.200000047684 | 7760.799999952316 | 1641.58 | soft-threshold |
| vello-wgpu | 1000 | 1936 | 30.866958 | 8.149750000000001 | 33.23 | healthy |
| vello-wgpu | 5000 | 9858 | 35.100708000000004 | 11.682167 | 2.58 | healthy |
| vello-wgpu | 10000 | 19800 | 40.06975 | 16.820249999999998 | 1.20 | healthy |
| vello-wgpu | 25000 | 49683 | 52.705333 | 30.619 | 2.73 | healthy |
| vello-wgpu | 50000 | 99552 | 32.481167 | 17.732709 | 2.52 | healthy |
| vello-wgpu | 100000 | 199367 | 91.759916 | 68.847042 | 165.41 | healthy |
| vello-wgpu | 250000 | 499000 | 90.30499999999999 | 77.53133399999999 | 243.58 | healthy |
| vello-wgpu | 500000 | 998585 | 165.90466600000002 | 148.627875 | 532.75 | soft-threshold |
| vello-wgpu | 1000000 |  |  |  | 310.81 | renderer-error |

## Controls and terminal points

The 1k control was run twice with `GRAPHT_BREAKPOINT_SIZES=1000 GRAPHT_BREAKPOINT_TIMEOUT_MS=30000 pnpm run benchmark:breakpoints`. First-render timings were 89.7/88.5 ms for Cytoscape, 13.9/13.6 ms for CanvasKit, 272.1/272.2 ms for Sigma, and 29.6/30.4 ms for Vello. The isolated worker process tree was sampled immediately and every 250 ms.

Cytoscape 250k reached 4.71 GiB sampled RSS and exceeded the 45 s isolated-worker limit. A 120 s retry reached 4.61 GiB before the resource-safe retry was stopped. The result is unresolved above the valid 100k point, with no confirmed Cytoscape renderer error captured. Sigma 100k completed on a 120 s isolated retry with first render 14,493.2 ms and interaction p95 7,760.8 ms. Vello 1m is a confirmed renderer/device allocation failure at the wgpu max buffer binding limit shown above. Points after each terminal condition were skipped for that renderer.
