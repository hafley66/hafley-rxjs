# Shared fixture memory comparison

Each row uses the same JSON bytes. JavaScript is the median retained V8 heap delta from 5 isolated processes with forced GC. Rust payload is exact owned struct, Vec capacity, and String capacity accounting; it excludes allocator metadata. Packed render bytes contain positions, numeric IDs/flags, and edge endpoints.

| nodes | edges | JSON MiB | JS parsed MiB | Rust parsed payload MiB | packed MiB | JS / Rust | JS / packed |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10000 | 19800 | 0.52 | 2.65 | 0.81 | 0.27 | 3.29x | 9.97x |
| 100000 | 199367 | 5.92 | 21.32 | 6.70 | 2.67 | 3.18x | 8.00x |
| 1000000 | 1998000 | 63.98 | 213.49 | 55.42 | 26.69 | 3.85x | 8.00x |
