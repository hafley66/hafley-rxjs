import { mkdir, readFile, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "..")
const fixtureDir = resolve(root, ".cache/render-fixtures")
const rustDir = resolve(root, "adapters/5_render_vello_wgpu")
const rustProbe = resolve(rustDir, "target/release/5_fixture_memory_probe")
const sizes = (process.env.GRAPHT_MEMORY_SIZES ?? "10000,100000,1000000").split(",").map(Number)
const trials = Number(process.env.GRAPHT_MEMORY_TRIALS ?? 5)

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = "", stderr = ""
    child.stdout.on("data", chunk => { stdout += chunk })
    child.stderr.on("data", chunk => { stderr += chunk })
    child.on("error", reject)
    child.on("close", code => code === 0 ? resolvePromise(stdout) : reject(new Error(`${command} exited ${code}: ${stderr}`)))
  })
}

const median = values => [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)]
await mkdir(fixtureDir, { recursive: true })
await run("cargo", ["build", "--release", "--bin", "5_fixture_memory_probe"], { cwd: rustDir })
const rows = []
for (const size of sizes) {
  await run(process.execPath, [resolve(here, "0_generate_renderer_fixture.mjs"), String(size), fixtureDir])
  const fixturePath = resolve(fixtureDir, `grid-${size}.json`)
  const rust = JSON.parse(await run(rustProbe, [fixturePath]))
  const jsTrials = []
  for (let trial = 0; trial < trials; trial++) jsTrials.push(JSON.parse(await run(process.execPath, ["--expose-gc", resolve(here, "1_measure_js_fixture.mjs"), fixturePath])))
  if (jsTrials.some(value => value.coordinateChecksum !== rust.coordinateChecksum)) throw new Error(`fixture checksum mismatch at ${size}`)
  const jsParsedHeapDeltaBytes = median(jsTrials.map(value => value.jsParsedHeapDeltaBytes))
  rows.push({ ...rust, jsParsedHeapDeltaBytes, jsTrials: jsTrials.map(value => value.jsParsedHeapDeltaBytes), jsToRustPayloadRatio: jsParsedHeapDeltaBytes / rust.rustRetainedPayloadBytes, jsonToRustPayloadRatio: rust.jsonBytes / rust.rustRetainedPayloadBytes, jsToPackedRatio: jsParsedHeapDeltaBytes / rust.packedRenderBytes })
}
const fields = ["nodeCount", "edgeCount", "jsonBytes", "jsParsedHeapDeltaBytes", "rustRetainedPayloadBytes", "packedRenderBytes", "jsToRustPayloadRatio", "jsonToRustPayloadRatio", "jsToPackedRatio"]
const csv = [fields.join(","), ...rows.map(row => fields.map(field => row[field]).join(","))].join("\n") + "\n"
const mib = value => (value / 1024 / 1024).toFixed(2)
const markdown = `# Shared fixture memory comparison\n\nEach row uses the same JSON bytes. JavaScript is the median retained V8 heap delta from ${trials} isolated processes with forced GC. Rust payload is exact owned struct, Vec capacity, and String capacity accounting; it excludes allocator metadata. Packed render bytes contain positions, numeric IDs/flags, and edge endpoints.\n\n| nodes | edges | JSON MiB | JS parsed MiB | Rust parsed payload MiB | packed MiB | JS / Rust | JS / packed |\n| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${rows.map(row => `| ${row.nodeCount} | ${row.edgeCount} | ${mib(row.jsonBytes)} | ${mib(row.jsParsedHeapDeltaBytes)} | ${mib(row.rustRetainedPayloadBytes)} | ${mib(row.packedRenderBytes)} | ${row.jsToRustPayloadRatio.toFixed(2)}x | ${row.jsToPackedRatio.toFixed(2)}x |`).join("\n")}\n`
const series = [
  { key: "jsonBytes", label: "JSON UTF-8", color: "#f59e0b" },
  { key: "jsParsedHeapDeltaBytes", label: "JavaScript objects", color: "#ef4444" },
  { key: "rustRetainedPayloadBytes", label: "Rust owned objects", color: "#3b82f6" },
  { key: "packedRenderBytes", label: "packed render buffers", color: "#22c55e" },
]
const width = 1200, height = 720, left = 100, right = 50, top = 70, bottom = 100
const maxX = Math.log10(Math.max(...rows.map(row => row.nodeCount)))
const maxY = Math.max(...rows.flatMap(row => series.map(value => row[value.key]))) / 1024 / 1024
const x = value => left + (Math.log10(value) / maxX) * (width - left - right)
const y = value => top + (1 - value / 1024 / 1024 / maxY) * (height - top - bottom)
const chart = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#0f172a"/><style>text{font:16px system-ui,sans-serif;fill:#e2e8f0}.axis{stroke:#64748b}.grid{stroke:#334155}.series{fill:none;stroke-width:4}.dot{stroke:#0f172a;stroke-width:2}</style><text x="${left}" y="36" font-size="24">Shared graph fixture retained memory</text>${[0,.25,.5,.75,1].map(part => `<line class="grid" x1="${left}" y1="${top + part * (height-top-bottom)}" x2="${width-right}" y2="${top + part * (height-top-bottom)}"/><text x="12" y="${top + part * (height-top-bottom) + 6}">${(maxY * (1-part)).toFixed(0)} MiB</text>`).join("")}<line class="axis" x1="${left}" y1="${height-bottom}" x2="${width-right}" y2="${height-bottom}"/>${rows.map(row => `<text x="${x(row.nodeCount)-18}" y="${height-bottom+30}">${row.nodeCount >= 1e6 ? `${row.nodeCount/1e6}m` : `${row.nodeCount/1e3}k`}</text>`).join("")}${series.map((value,index) => `<polyline class="series" stroke="${value.color}" points="${rows.map(row => `${x(row.nodeCount)},${y(row[value.key])}`).join(" ")}"/>${rows.map(row => `<circle class="dot" fill="${value.color}" cx="${x(row.nodeCount)}" cy="${y(row[value.key])}" r="6"/>`).join("")}<rect fill="${value.color}" x="${left+index*250}" y="${height-48}" width="18" height="18"/><text x="${left+24+index*250}" y="${height-33}">${value.label}</text>`).join("")}</svg>`
await writeFile(resolve(root, "results/4_fixture_memory.json"), JSON.stringify(rows, null, 2))
await writeFile(resolve(root, "results/4_fixture_memory.csv"), csv)
await writeFile(resolve(root, "results/4_fixture_memory.md"), markdown)
await writeFile(resolve(root, "results/4_fixture_memory.svg"), chart)
await run("rsvg-convert", ["-o", resolve(root, "results/4_fixture_memory.png"), resolve(root, "results/4_fixture_memory.svg")])
process.stdout.write(markdown)
