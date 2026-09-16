// The command end to end over a real repository: a log beside its document, a commit whose trailer
// names the message, and the line that joins them. Exit codes match grapht-history.
import { execFile } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

import { mdAddressIndex, mdDocument } from "@hafley66/grapht-model"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { messagesToJsonl, withMessageId } from "../../src/index.js"
import { docHistoryMain } from "../../src/7_docHistory/2_cli.js"

const execFileAsync = promisify(execFile)

const TEXT = ["# Notes", "", "Intro paragraph.", "", "## Usage", "", "Nested body text.", ""].join("\n")

async function commit(repository: string, message: string, date: string): Promise<string> {
  await execFileAsync("git", ["add", "-A"], { cwd: repository })
  await execFileAsync("git", ["commit", "-m", message, "--date", date], {
    cwd: repository,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "ingest",
      GIT_AUTHOR_EMAIL: "ingest@localhost",
      GIT_COMMITTER_NAME: "ingest",
      GIT_COMMITTER_EMAIL: "ingest@localhost",
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    },
  })
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repository })
  return stdout.trim()
}

/** Both streams, so a test can read what the caller would see on each. */
function capture(): { out: string[]; err: string[]; restore: () => void } {
  const out: string[] = []
  const err: string[] = []
  const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    out.push(String(chunk))
    return true
  })
  const stderr = vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    err.push(String(chunk))
    return true
  })
  return { out, err, restore: () => (stdout.mockRestore(), stderr.mockRestore()) }
}

describe("grapht-doc-history", () => {
  let repository = ""
  let cwd = ""

  beforeEach(async () => {
    repository = await mkdtemp(join(tmpdir(), "grapht-doc-history-"))
    cwd = process.cwd()
    await execFileAsync("git", ["init", "--initial-branch=main"], { cwd: repository })
  })

  afterEach(async () => {
    process.chdir(cwd)
    await rm(repository, { recursive: true, force: true })
  })

  test("prints a message with the revisions it was written against and resolved by", async () => {
    await writeFile(join(repository, "docs-notes.md"), TEXT, "utf8")
    await execFileAsync("mkdir", ["-p", join(repository, "docs")])
    await writeFile(join(repository, "docs/example.md"), TEXT, "utf8")
    const written = await commit(repository, "docs: the note", "2026-09-01T10:00:00+00:00")

    const document = mdDocument("docs/example.md", TEXT)
    const block = document.blocks[2]
    const address = block ? (await mdAddressIndex(document)).byBlockId.get(block.id) : undefined
    if (!address) throw new Error("fixture changed")
    const message = withMessageId({
      thread: "t1",
      author: { kind: "agent", id: "claude", model: "opus" },
      at: "2026-09-02T10:00:00.000Z",
      kind: "question",
      target: address,
      body: "Does this paragraph still say what it said?",
      baseRevision: written,
    })
    await writeFile(
      join(repository, "docs/example.md.messages.jsonl"),
      messagesToJsonl({ format: "grapht-messages/0", artifact: "docs/example.md", messages: [message] }),
      "utf8",
    )
    const resolved = await commit(
      repository,
      `docs: answer the question\n\nGrapht-Artifacts: docs/example.md\nGrapht-Messages: ${message.id}`,
      "2026-09-03T10:00:00+00:00",
    )

    process.chdir(repository)
    const streams = capture()
    const code = await docHistoryMain(["docs/example.md"])
    streams.restore()

    expect(streams.err).toEqual([])
    expect(code).toBe(0)
    expect(streams.out.join("")).toContain(message.id.slice(0, 8))
    expect(streams.out.join("")).toContain("anchored")
    expect(streams.out.join("")).toContain(`wrote-against ${written.slice(0, 8)}`)
    expect(streams.out.join("")).toContain(`resolved-by ${resolved.slice(0, 8)}`)
    expect(streams.out.at(-1)).toBe("1 message(s), 0 anomaly(ies)\n")
  })

  test("fails on a trailer that names a message the log does not hold", async () => {
    await execFileAsync("mkdir", ["-p", join(repository, "docs")])
    await writeFile(join(repository, "docs/example.md"), TEXT, "utf8")
    const message = withMessageId({
      thread: "t1",
      author: { kind: "human", id: "chris" },
      at: "2026-09-02T10:00:00.000Z",
      kind: "note",
      target: { kind: "board", boardId: "b1", itemId: "i1" },
      body: "Move this next to the fence.",
    })
    await writeFile(
      join(repository, "docs/example.md.messages.jsonl"),
      messagesToJsonl({ format: "grapht-messages/0", artifact: "docs/example.md", messages: [message] }),
      "utf8",
    )
    await commit(
      repository,
      `docs: pin it\n\nGrapht-Artifacts: docs/example.md\nGrapht-Messages: ${message.id},not-in-the-log`,
      "2026-09-03T10:00:00+00:00",
    )

    process.chdir(repository)
    const streams = capture()
    const code = await docHistoryMain(["docs/example.md"])
    streams.restore()

    expect(code).toBe(1)
    expect(streams.err.join("")).toContain("names message not-in-the-log, which this log does not hold")
    // A board target is not markdown's to resolve, and the line says so rather than guessing.
    expect(streams.out.join("")).toContain("unaddressable (board)")
  })

  test("separates usage from an empty history", async () => {
    const usage = capture()
    const missing = await docHistoryMain([])
    usage.restore()
    expect(missing).toBe(2)
    expect(usage.err.join("")).toContain("usage: grapht-doc-history <artifact-path>")

    await execFileAsync("mkdir", ["-p", join(repository, "docs")])
    await writeFile(join(repository, "docs/example.md"), TEXT, "utf8")
    process.chdir(repository)
    const quiet = capture()
    const none = await docHistoryMain(["docs/example.md"])
    quiet.restore()
    expect(none).toBe(0)
    expect(quiet.out.join("")).toContain("0 messages")
  })
})