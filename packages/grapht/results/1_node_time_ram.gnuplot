set terminal svg size 1200,720 dynamic enhanced font "Arial,15" background rgb "#111827"
set output "packages/grapht/results/1_node_time_ram.svg"
set datafile separator comma
set key outside top center horizontal textcolor rgb "#e5e7eb"
set title "Grapht layout sweep: nodes vs wall time and peak RSS" textcolor rgb "#f9fafb"
set xlabel "nodes" textcolor rgb "#e5e7eb"
set ylabel "median wall time (ms)" textcolor rgb "#60a5fa"
set y2label "median peak RSS (MiB)" textcolor rgb "#f59e0b"
set border lc rgb "#6b7280"
set xtics textcolor rgb "#d1d5db"
set ytics nomirror textcolor rgb "#60a5fa"
set y2tics textcolor rgb "#f59e0b"
set grid lc rgb "#374151"
set yrange [45:62]
set y2range [58:80]
set style line 1 lc rgb "#60a5fa" lw 3 pt 7 ps 1.2
set style line 2 lc rgb "#2563eb" lw 3 pt 5 ps 1.2
set style line 3 lc rgb "#fbbf24" lw 3 dt 2 pt 7 ps 1.2
set style line 4 lc rgb "#d97706" lw 3 dt 2 pt 5 ps 1.2
plot \
  "packages/grapht/results/1_node_time_ram.csv" every ::1::3 using 2:4 with linespoints ls 1 axes x1y1 title "JS worker time", \
  "packages/grapht/results/1_node_time_ram.csv" every ::4::6 using 2:4 with linespoints ls 2 axes x1y1 title "Rust/Wasm time", \
  "packages/grapht/results/1_node_time_ram.csv" every ::1::3 using 2:($7/1024) with linespoints ls 3 axes x1y2 title "JS worker RSS", \
  "packages/grapht/results/1_node_time_ram.csv" every ::4::6 using 2:($7/1024) with linespoints ls 4 axes x1y2 title "Rust/Wasm RSS"
