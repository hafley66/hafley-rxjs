import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import {
  analyzeOutput,
  type BenchInput,
  type BenchOutput,
  benchOutputSchema,
  type OutputAnalysis,
  parseBenchInput,
  parseJsonl,
} from "./0_benchProtocol.js"
import { packageRoot } from "./2_fixtures.js"
import { directoryBytes, hashFile } from "./3_hash.js"
import { diagnosticsOnly, measureCommand } from "./4_process.js"
import { readAllStdin, writeJson, writeText } from "./8_cli.js"

export type RunReport = {
  runId: string
  status: "ok" | "adapter-error" | "bench-error" | "invalid-output"
  harnessExit: number
  adapterExit: number | null
  signal: string | null
  wallMs: number
  cpuUserMs: number
  cpuSysMs: number
  peakRssKb: number
  stdoutBytes: number
  stderrBytes: number
  artifactBytes: number
  terminal: string | null
  sampleCount: number
  artifactHashValid: boolean | null
  runDir: string
}

export async function runBenchMain(argv: string[]): Promise<number> {
  const args = new Map<string, string>()
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith("--")) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith("--")) {
        args.set(key, next)
        i++
      } else {
        args.set(key, "")
      }
    } else {
      args.set("adapter", args.get("adapter") ?? arg)
    }
  }

  const adapter = args.get("adapter") ?? ""
  if (!adapter) {
    process.stderr.write("grapht-bench run --adapter <command> [--output <dir>] [--fixture <name>]\n")
    return 1
  }

  const outputRoot = args.get("output")
    ? resolve(process.cwd(), args.get("output") as string)
    : resolve(packageRoot(import.meta.url), "runs")

  let inputText: string
  try {
    inputText = await readAllStdin()
  } catch (error) {
    process.stderr.write(`failed to read stdin: ${(error as Error).message}\n`)
    return 1
  }

  let benchInput: BenchInput
  try {
    benchInput = parseBenchInput(inputText)
  } catch (error) {
    process.stderr.write(`invalid BenchInput: ${(error as Error).message}\n`)
    return 1
  }

  const runId = benchInput.runId
  const runDir = resolve(outputRoot, runId)
  const artifactsDir = resolve(runDir, "artifacts")
  const normalized = { ...benchInput, outputDirectory: artifactsDir }
  const requestText = JSON.stringify(normalized)

  await mkdir(artifactsDir, { recursive: true })
  await writeJson(resolve(runDir, "request.json"), normalized)

  const measured = await measureCommand(adapter, requestText)
  const diagnostics = diagnosticsOnly(measured.stderr)
  await writeText(resolve(runDir, "events.jsonl"), measured.stdout)
  await writeText(resolve(runDir, "diagnostics.txt"), diagnostics)

  const stdoutBytes = Buffer.byteLength(measured.stdout)
  const stderrBytes = Buffer.byteLength(diagnostics)

  const entries = parseJsonl(measured.stdout, benchOutputSchema)
  const records: { line: number; value: BenchOutput }[] = []
  for (const entry of entries) {
    if (entry.ok) records.push({ line: entry.line, value: entry.value })
  }
  const parseErrors = entries.filter(entry => !entry.ok)
  const analysis: OutputAnalysis = analyzeOutput(records, runId)
  for (const err of parseErrors) {
    analysis.issues.push({ line: err.line, message: err.error })
  }

  const artifactHashValid =
    analysis.terminal?.kind === "result" && analysis.terminal.value.artifact
      ? (await hashFile(resolve(artifactsDir, analysis.terminal.value.artifact)).catch(() => null)) ===
        analysis.terminal.value.artifactHash
      : null

  const artifactBytes = (await directoryBytes(artifactsDir)).bytes

  let status: RunReport["status"]
  let exit: number
  if (measured.exitCode !== null && measured.exitCode !== 0) {
    status = "adapter-error"
    exit = 2
  } else if (measured.signal) {
    status = "adapter-error"
    exit = 2
  } else if (!analysis.terminal) {
    status = "invalid-output"
    exit = 3
  } else if (analysis.terminal.kind === "error") {
    status = "bench-error"
    exit = 3
  } else if (analysis.issues.length > 0) {
    status = "invalid-output"
    exit = 3
  } else {
    status = "ok"
    exit = 0
  }

  const result: RunReport = {
    runId,
    status,
    harnessExit: exit,
    adapterExit: measured.exitCode,
    signal: measured.signal,
    wallMs: Math.round(measured.wallMs),
    cpuUserMs: measured.cpuUserMs,
    cpuSysMs: measured.cpuSysMs,
    peakRssKb: measured.peakRssKb,
    stdoutBytes,
    stderrBytes,
    artifactBytes,
    terminal: analysis.terminal ? analysis.terminal.kind : null,
    sampleCount: analysis.samples.length,
    artifactHashValid,
    runDir,
  }

  await writeJson(resolve(runDir, "process.json"), {
    protocol: "grapht-bench/0",
    type: "process",
    runId,
    adapter,
    wallMs: result.wallMs,
    cpuUserMs: result.cpuUserMs,
    cpuSysMs: result.cpuSysMs,
    peakRssKb: result.peakRssKb,
    stdoutBytes,
    stderrBytes,
    artifactBytes,
    exitCode: measured.exitCode,
    signal: measured.signal,
  })

  await writeJson(resolve(runDir, "analysis.json"), {
    status,
    terminal: analysis.terminal
      ? {
          kind: analysis.terminal.kind,
          ...(analysis.terminal.kind === "result"
            ? { implementation: analysis.terminal.value.implementation }
            : { message: analysis.terminal.value.message }),
        }
      : null,
    sampleCount: analysis.samples.length,
    issues: analysis.issues,
    artifactHashValid,
  })

  const summary = {
    protocol: "grapht-bench/0",
    type: "run-summary",
    runId,
    status,
    harnessExit: exit,
    adapterExit: measured.exitCode,
    terminal: analysis.terminal ? analysis.terminal.kind : null,
    wallMs: result.wallMs,
    artifactBytes,
    runDir,
  }
  process.stdout.write(`${JSON.stringify(summary)}\n`)
  return exit
}
