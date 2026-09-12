#!/usr/bin/env node
setTimeout(() => {
  process.stdout.write(JSON.stringify({ protocol: "grapht-bench/0", type: "sample", runId: "never", phase: "sleep", startedNs: 0, endedNs: 0, counters: {} }) + "\n")
}, 5000)
