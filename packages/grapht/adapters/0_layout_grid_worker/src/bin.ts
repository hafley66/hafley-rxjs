import { performance } from "node:perf_hooks"
import { createInterface } from "node:readline"
import { BENCH_PROTOCOL, encodeJsonLine, isBenchInput, type BenchInput } from "./0_protocol.js"
import { FIXTURES, generateFixture } from "./5_fixtures.js"
import { runAdapter } from "./4_adapter.js"

function writeLine(value: unknown): void { process.stdout.write(encodeJsonLine(value)) }
async function readInput(): Promise<{ input: BenchInput; parseNs: number }> {
  const started = performance.now() * 1e6
  for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    if (!line.trim()) continue
    const value: unknown = JSON.parse(line)
    if (!isBenchInput(value)) throw new Error("stdin record is not a valid grapht-bench/0 BenchInput")
    return { input: value, parseNs: Math.round(performance.now() * 1e6 - started) }
  }
  throw new Error("no BenchInput record found on stdin")
}
export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  if (argv[0] === "emit") {
    const fixture = FIXTURES.find(({ name }) => name === argv[1])
    if (!fixture) { process.stderr.write(`usage: layout-grid-worker emit <${FIXTURES.map(({ name }) => name).join("|` or `")}>\n`); return 2 }
    writeLine({ protocol: BENCH_PROTOCOL, runId: `emit-${fixture.name}`, fixture: fixture.name, operation: "layout", input: JSON.stringify(generateFixture(fixture)), outputDirectory: ".", parameters: {} })
    return 0
  }
  let input: BenchInput | undefined
  try {
    const parsed = await readInput(); input = parsed.input
    const output = await runAdapter(parsed.input, parsed.parseNs)
    output.samples.forEach(writeLine); writeLine(output.result); return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    writeLine({ protocol: BENCH_PROTOCOL, type: "error", runId: input?.runId ?? "unknown", message }); process.stderr.write(`${message}\n`); return 1
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main().then((code) => process.exit(code)).catch((error) => { process.stderr.write(`${error}\n`); process.exit(1) })
