import { gridTopology, loadFixtureDefs, makeBenchInput } from "./2_fixtures.js"

export async function fixturesMain(argv: string[]): Promise<number> {
  const command = argv[0] ?? ""
  if (command === "list") {
    const defs = await loadFixtureDefs(import.meta.url)
    const rows: string[] = []
    for (const def of defs) {
      const topology = gridTopology(def.rows, def.cols, def.seed)
      rows.push(`${def.id}\tnodes=${topology.nodeIds.length}\tedges=${topology.edges.length}`)
    }
    process.stdout.write(`${rows.join("\n")}\n`)
    return 0
  }

  if (command === "emit") {
    const fixtureName = argv[1]
    if (!fixtureName) {
      process.stderr.write("grapht-fixtures emit <fixture> [--operation <layout|render|interaction>]\n")
      return 1
    }
    const operationIndex = argv.indexOf("--operation")
    const operation =
      operationIndex >= 0 && argv[operationIndex + 1]
        ? (argv[operationIndex + 1] as "layout" | "render" | "interaction")
        : "layout"
    const benchInput = await makeBenchInput(fixtureName, import.meta.url, operation)
    process.stdout.write(`${JSON.stringify(benchInput)}\n`)
    return 0
  }

  process.stderr.write("grapht-fixtures <list|emit <fixture> [--operation <layout|render|interaction>]>\n")
  return 1
}
