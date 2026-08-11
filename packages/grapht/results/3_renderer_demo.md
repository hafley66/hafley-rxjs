# Renderer breakpoint sweep

Deterministic grid topology. x=node count. Time fields are browser/native renderer timings. RSS is the sampled renderer process tree. Hard break means crash, OOM, timeout, device loss, allocation failure, or renderer error. Soft thresholds remain healthy rows.

| renderer | highest healthy | first soft threshold | first harness failure | first confirmed renderer failure |
| --- | ---: | ---: | ---: | ---: |
| cytoscape | 1000 nodes | none | none observed | none observed |
| canvaskit | 1000 nodes | none | none observed | none observed |
| sigma | 1000 nodes | none | none observed | none observed |

| renderer | nodes | edges | first render ms | interaction p95 ms | peak RSS MiB | status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| cytoscape | 1000 | 1936 | 286.40000009536743 | 14.599999904632568 | 1269.05 | healthy |
| canvaskit | 1000 | 1936 | 11.300000190734863 | 8.700000047683716 | 1239.70 | healthy |
| sigma | 1000 | 1936 | 15.900000095367432 | 8.400000095367432 | 1249.41 | healthy |
