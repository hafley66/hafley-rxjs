// The message log's claims: an id is the tuple it was written with, reading verifies rather than
// trusts, structural defects are named without reading a body, and an addressed message is as
// durable as the address under it.
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { type MdAddress, type MdDocument, mdAddressIndex, mdDocument } from "@hafley66/grapht-model"
import { describe, expect, test } from "vitest"
import {
  type DocMessage,
  jsonlToMessages,
  messageAnchorState,
  messageAnomalies,
  messageLogPathFor,
  messagesToJsonl,
  readMessageLog,
  targetKeyOf,
  withMessageId,
  writeMessageLog,
} from "../../src/index.js"

const TEXT = [
  "# Board notes",
  "",
  "Intro paragraph with a [link](#usage).",
  "",
  "## Usage",
  "",
  "```mermaid",
  "sequenceDiagram",
  "  Alice->>Bob: hi",
  "```",
  "",
  "### Details",
  "",
  "Nested body text.",
].join("\n")

const read = (text: string, path = "docs/example.md"): MdDocument => mdDocument(path, text)
const addressOf = async (document: MdDocument, index: number): Promise<MdAddress> => {
  const block = document.blocks[index]
  if (!block) throw new Error("fixture changed")
  const address = (await mdAddressIndex(document)).byBlockId.get(block.id)
  if (!address) throw new Error("fixture changed")
  return address
}

const draft = (address: MdAddress, body = "Does this paragraph still say what it said?"): Omit<DocMessage, "id"> => ({
  thread: "t1",
  author: { kind: "agent", id: "claude", model: "opus" },
  at: "2026-09-15T20:00:00.000Z",
  kind: "question",
  target: address,
  body,
})

/** A temp directory per test, gone whether the test passed or failed. */
async function inTempDirectory<T>(run: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "grapht-messages-"))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

describe("message log", () => {
  test("derives the id from the tuple it was written with", async () => {
    const address = await addressOf(read(TEXT), 3)
    const base = draft(address)
    const id = withMessageId(base).id

    expect(withMessageId({ ...base }).id).toBe(id)
    expect(withMessageId({ ...base, body: "different" }).id).not.toBe(id)
    expect(withMessageId({ ...base, at: "2026-09-15T20:00:01.000Z" }).id).not.toBe(id)
    expect(withMessageId({ ...base, author: { kind: "human", id: "chris" } }).id).not.toBe(id)
    // The target enters through its key, so two messages about the same bytes share a locator.
    expect(targetKeyOf({ ...address, span: { start: 0, end: 0, lineStart: 1, lineEnd: 1 } })).toBe(
      targetKeyOf(address),
    )
    expect(targetKeyOf({ kind: "board", boardId: "b1", itemId: address.locatorHash })).not.toBe(
      targetKeyOf(address),
    )
  })

  test("prints one message per line and refuses a body that does not answer for its id", async () => {
    const address = await addressOf(read(TEXT), 3)
    const message = withMessageId(draft(address))
    const log = { format: "grapht-messages/0" as const, artifact: "docs/example.md", messages: [message] }
    const text = messagesToJsonl(log)

    expect(text.split("\n").filter(line => line.length > 0)).toHaveLength(2)
    expect(jsonlToMessages(text)).toEqual(log)
    expect(() => jsonlToMessages(text.replace("Does this paragraph", "Did that paragraph"))).toThrow(
      /fails its own id/,
    )
    expect(() => jsonlToMessages("")).toThrow(/empty/)
    expect(() => jsonlToMessages(JSON.stringify({ format: "grapht-messages/1", artifact: "x" }))).toThrow(
      /unknown message log format: grapht-messages\/1/,
    )
  })

  test("names duplicate ids, a dangling reply, and a time that runs backwards", async () => {
    const address = await addressOf(read(TEXT), 3)
    const first = withMessageId(draft(address))
    const second = withMessageId({ ...draft(address, "A second question."), at: "2026-09-15T21:00:00.000Z" })
    const clean = { format: "grapht-messages/0" as const, artifact: "docs/example.md", messages: [first, second] }
    expect(messageAnomalies(clean)).toEqual([])
    // A reply is allowed to be written before the message it answers.
    expect(
      messageAnomalies({ ...clean, messages: [{ ...first, replyTo: second.id }, second] }),
    ).toEqual([])

    expect(
      messageAnomalies({ ...clean, messages: [first, second, { ...first }] }).filter(anomaly =>
        anomaly.startsWith("duplicate"),
      ),
    ).toEqual([`duplicate message ${first.id}`])
    expect(messageAnomalies({ ...clean, messages: [{ ...first, replyTo: "gone" }, second] })).toEqual([
      `message ${first.id} replies to gone, which this log does not hold`,
    ])
    expect(messageAnomalies({ ...clean, messages: [second, first] }).at(-1)).toBe(
      `message ${first.id} is written before its predecessor`,
    )
  })

  test("keeps an addressed message as durable as the address under it", async () => {
    const before = read(TEXT)
    const address = await addressOf(before, 3)
    const message = withMessageId(draft(address))

    const inPlace = read(TEXT.replace("Intro paragraph", "Intro paragraph, reworded"))
    expect(await messageAnchorState(message, [inPlace])).toEqual({ state: "anchored", address: expect.anything() })

    // Text edited above the block: the block's own bytes are untouched, so the message follows it.
    const inserted = read(TEXT.replace("## Usage", "## Usage\n\nAdded above the fence."))
    const reanchored = await messageAnchorState(message, [inserted])
    expect(reanchored.state).toBe("reanchored")
    if (reanchored.state !== "reanchored") throw new Error("expected a reanchored message")
    expect(reanchored.previousSpan).toEqual(address.span)
    expect(reanchored.address.locatorHash).not.toBe(address.locatorHash)

    const rewritten = read(TEXT.replace(TEXT.slice(address.span.start, address.span.end), "Rewritten body text."))
    expect(await messageAnchorState(message, [rewritten])).toEqual({ state: "orphaned", reason: "missing" })

    expect(await messageAnchorState({ ...message, target: { kind: "board", boardId: "b1", itemId: "i1" } }, [before])).toEqual(
      { state: "unaddressable", reason: "board" },
    )
    expect(await messageAnchorState(message, [read(TEXT, "docs/other.md")])).toEqual({
      state: "unaddressable",
      reason: "no-document",
    })
  })

  test("writes the log beside its artefact and refuses one that will not verify", async () => {
    await inTempDirectory(async directory => {
      const address = await addressOf(read(TEXT), 3)
      const log = {
        format: "grapht-messages/0" as const,
        artifact: "docs/example.md",
        messages: [withMessageId(draft(address))],
      }
      const path = join(directory, messageLogPathFor("example.md"))
      expect(messageLogPathFor("example.md")).toBe("example.md.messages.jsonl")

      writeMessageLog(path, log)
      expect(readMessageLog(path)).toEqual(log)

      await writeFile(path, "{}\n", "utf8")
      expect(() => readMessageLog(path)).toThrow(new RegExp(`message log .*${path.split("/").pop()}`))
    })
  })
})