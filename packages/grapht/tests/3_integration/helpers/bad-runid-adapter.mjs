#!/usr/bin/env node
let input = ""
process.stdin.on("data", (chunk) => (input += chunk))
process.stdin.on("end", () => {
  const req = JSON.parse(input)
  process.stdout.write(
    JSON.stringify({
      protocol: "grapht-bench/0",
      type: "result",
      runId: `mismatch-${req.runId}`,
      implementation: "bad-runid",
      operation: req.operation,
      counters: {},
    }) + "\n",
  )
})
