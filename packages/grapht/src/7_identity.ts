import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { BENCH_PROTOCOL, type BenchResult, type BenchSample, parseBenchInput } from "./0_benchProtocol.js"
import { hashFile } from "./3_hash.js"
import { readAllStdin, writeText } from "./8_cli.js"

export function identityMain(): Promise<number> {
  return (async () => {
    const phaseStart = process.hrtime.bigint()
    const inputText = await readAllStdin()
    let runId = "unknown"
    let operation: "layout" | "render" | "interaction" = "layout"
    let outputDirectory = "."
    try {
      const benchInput = parseBenchInput(inputText)
      runId = benchInput.runId
      operation = benchInput.operation
      outputDirectory = benchInput.outputDirectory
    } catch (error) {
      process.stdout.write(
        `${JSON.stringify({ protocol: BENCH_PROTOCOL, type: "error", runId, message: (error as Error).message })}\n`,
      )
      return 1
    }

    const artifactRel = "identity/request.json"
    const artifactAbs = resolve(outputDirectory, artifactRel)
    await mkdir(resolve(outputDirectory, "identity"), { recursive: true })
    await writeText(artifactAbs, inputText)
    const artifactHash = await hashFile(artifactAbs)

    const phaseEnd = process.hrtime.bigint()
    const sample: BenchSample = {
      protocol: BENCH_PROTOCOL,
      type: "sample",
      runId,
      phase: "total",
      startedNs: Number(phaseStart),
      endedNs: Number(phaseEnd),
      counters: {},
    }
    const result: BenchResult = {
      protocol: BENCH_PROTOCOL,
      type: "result",
      runId,
      implementation: "identity",
      operation,
      artifact: artifactRel,
      artifactHash,
      counters: {},
    }
    process.stdout.write(`${JSON.stringify(sample)}\n`)
    process.stdout.write(`${JSON.stringify(result)}\n`)
    return 0
  })()
}
