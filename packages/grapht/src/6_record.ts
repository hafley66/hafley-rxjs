import { createWriteStream } from "node:fs"
import { access, mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { createInterface } from "node:readline"
import { benchOutputSchema } from "./0_benchProtocol.js"

export type RecordSummary = {
  protocol: "grapht-bench/0"
  type: "record-summary"
  output: string
  valid: number
  invalid: number
  okay: boolean
}

export function recordMain(args: Map<string, string>): Promise<number> {
  const output = args.get("output") ? resolve(process.cwd(), args.get("output") as string) : resolve("runs/recorded")
  const requestRunId = args.get("request") || null

  return new Promise<number>(resolvePromise => {
    void (async () => {
      await mkdir(output, { recursive: true })
      const eventsPath = resolve(output, "events.jsonl")
      const invalidPath = resolve(output, "invalid.jsonl")

      let expectedRunId: string | null = requestRunId
      if (!expectedRunId) {
        try {
          await access(resolve(output, "request.json"))
          const { readFile } = await import("node:fs/promises")
          const request = JSON.parse(await readFile(resolve(output, "request.json"), "utf8")) as {
            runId?: string
          }
          if (request.runId) expectedRunId = request.runId
        } catch {
          expectedRunId = null
        }
      }

      const events = createWriteStream(eventsPath, { flags: "a" })
      const invalid = createWriteStream(invalidPath, { flags: "a" })
      let valid = 0
      let invalidCount = 0
      const append = (stream: NodeJS.WritableStream, text: string): void => {
        if (!stream.write(`${text}\n`)) {
          // Backpressure ignored for a benchmark collector; buffer grows in memory.
        }
      }

      const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })
      rl.on("line", line => {
        if (line.trim() === "") return
        let parsed: unknown
        try {
          parsed = JSON.parse(line) as unknown
        } catch {
          invalidCount++
          append(invalid, JSON.stringify({ line, error: "invalid JSON" }))
          return
        }
        const result = benchOutputSchema.safeParse(parsed)
        if (result.success && (!expectedRunId || result.data.runId === expectedRunId)) {
          valid++
          append(events, line)
        } else {
          invalidCount++
          const reason = result.success
            ? `runId mismatch: expected ${expectedRunId}`
            : result.error.issues.map(issue => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ")
          append(invalid, JSON.stringify({ line, error: reason }))
        }
      })

      rl.on("close", () => {
        events.end(() => {
          invalid.end(() => {
            const summary: RecordSummary = {
              protocol: "grapht-bench/0",
              type: "record-summary",
              output,
              valid,
              invalid: invalidCount,
              okay: invalidCount === 0,
            }
            process.stdout.write(`${JSON.stringify(summary)}\n`)
            resolvePromise(invalidCount === 0 ? 0 : 1)
          })
        })
      })
    })()
  })
}
