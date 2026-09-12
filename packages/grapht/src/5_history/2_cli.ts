import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { gitHistoryJournal } from "./1_gitWalk.js"
import { journalAnomalies, journalToJsonl } from "./0_journal.js"

export async function historyMain(argv: readonly string[]): Promise<number> {
  const [input, outputArg] = argv
  if (input === undefined) {
    process.stderr.write("usage: grapht-history <diagram-path> [journal-path]\n")
    return 2
  }
  const workingDirectory = process.cwd()
  const journal = await gitHistoryJournal(workingDirectory, input)
  const anomalies = journalAnomalies(journal)
  for (const anomaly of anomalies) process.stderr.write(`${anomaly}\n`)

  const output = resolve(outputArg ?? `${input}.history.jsonl`)
  await writeFile(output, journalToJsonl(journal), "utf8")
  process.stdout.write(`${journal.revisions.length} revisions -> ${output}\n`)
  return anomalies.length > 0 ? 1 : 0
}
