# Layout sweep: nodes, wall time, and peak RSS

Measured 2026-08-11 through `grapht-bench/0` using macOS `/usr/bin/time -l` around each adapter process.

| implementation | nodes | runs | wall median ms | wall range ms | peak RSS median MiB | RSS range MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| JS worker | 1,024 | 6 | 53 | 50–54 | 62.48 | 61.83–62.72 |
| JS worker | 5,041 | 5 | 56 | 55–58 | 71.20 | 70.03–71.48 |
| JS worker | 10,000 | 5 | 58 | 57–59 | 76.66 | 76.52–77.80 |
| Rust/Wasm | 1,024 | 5 | 49 | 48–54 | 62.05 | 61.97–62.50 |
| Rust/Wasm | 5,041 | 5 | 53 | 52–59 | 64.16 | 63.81–64.31 |
| Rust/Wasm | 10,000 | 5 | 58 | 55–60 | 74.69 | 72.94–75.08 |

Chart axes:

- x: node count
- y: median process wall time in milliseconds
- y2: median peak RSS in MiB

The process measurement includes Node startup, worker startup, parsing, transfer, layout, artifact serialization, and process shutdown. Raw aggregate data is in `1_node_time_ram.csv`.
