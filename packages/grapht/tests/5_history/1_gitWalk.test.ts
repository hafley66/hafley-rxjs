import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

import { describe, expect, it } from "vitest"

import { contentHashOf, journalToJsonl, jsonlToJournal, journalAnomalies } from "../../src/5_history/0_journal.js"
import { gitHistoryJournal } from "../../src/5_history/1_gitWalk.js"

const execFileAsync = promisify(execFile)

async function commitAll(repository: string, message: string, date: string): Promise<string> {
  await execFileAsync("git", ["add", "-A"], { cwd: repository })
  await execFileAsync("git", ["commit", "-m", message, "--date", date], {
    cwd: repository,
    env: { ...process.env, GIT_AUTHOR_NAME: "ingest", GIT_AUTHOR_EMAIL: "ingest@localhost", GIT_COMMITTER_NAME: "ingest", GIT_COMMITTER_EMAIL: "ingest@localhost", GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  })
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repository })
  return stdout.trim()
}

describe("git history journal", () => {
  it("walks a real repository into a verifiable journal", async () => {
    const repository = await mkdtemp(join(tmpdir(), "grapht-history-"))
    try {
      await execFileAsync("git", ["init", "--initial-branch=main"], { cwd: repository })
      const diagram = join(repository, "arch.d2")
      const contents = [
        "x -> y\n",
        "x -> y\ny -> z\n",
        "x -> y\ny -> z\nz -> x\n",
      ]
      const hashes: string[] = []
      for (const [index, content] of contents.entries()) {
        await writeFile(diagram, content, "utf8")
        const output = await commitAll(repository, `rev ${index}`, `2026-09-0${index + 1}T10:00:00+00:00`)
        hashes.push(/[\da-f]{40}/.exec(output)?.[0] as string)
      }

      const journal = await gitHistoryJournal(repository, "arch.d2")
      expect(journal.revisions).toHaveLength(3)
      expect(journal.revisions.map(revision => revision.content)).toEqual(contents)
      expect(journal.revisions.map(revision => revision.contentHash)).toEqual(contents.map(contentHashOf))
      expect(journal.revisions.map(revision => revision.revisionId)).toEqual(hashes)
      expect(journal.revisions[2]?.parentRevisionIds).toEqual([hashes[1]])
      expect(journal.revisions.map(revision => revision.message)).toEqual(["rev 0", "rev 1", "rev 2"])
      expect(journal.revisions.map(revision => revision.capturedAt.slice(0, 10))).toEqual([
        "2026-09-01",
        "2026-09-02",
        "2026-09-03",
      ])
      expect(journalAnomalies(journal)).toEqual([])

      const roundTrip = jsonlToJournal(journalToJsonl(journal))
      expect(roundTrip).toEqual(journal)

      const corrupted = journalToJsonl(journal).replace("x -> y", "x -> q")
      expect(() => jsonlToJournal(corrupted)).toThrow(/fails its content hash/)
    } finally {
      await rm(repository, { recursive: true, force: true })
    }
  })
})
