// The trailer and the lifecycle it feeds: what a commit says it wrote, and what the log says about
// it. Pure, so the whole history view can be reasoned about without a repository.
import { type MdAddress, type MdDocument, mdAddressIndex, mdDocument } from "@hafley66/grapht-model"
import { describe, expect, test } from "vitest"
import {
  type TrailerCommit,
  anchorLabelOf,
  docHistoryAnomalies,
  docHistoryLines,
  messageLifecycles,
  parseCommitTrailers,
  renderCommitTrailers,
  trailerCommitsFor,
  withMessageId,
} from "../../src/index.js"

const TEXT = ["# Notes", "", "Intro paragraph.", "", "## Usage", "", "Nested body text.", ""].join("\n")

const addressAt = async (document: MdDocument, index: number): Promise<MdAddress> => {
  const block = document.blocks[index]
  const address = block ? (await mdAddressIndex(document)).byBlockId.get(block.id) : undefined
  if (!address) throw new Error("fixture changed")
  return address
}

const commit = (revisionId: string, at: string, messages: readonly string[] = [], artifacts: readonly string[] = []): TrailerCommit => ({
  revisionId,
  at,
  trailers: { artifacts, messages },
})

describe("commit trailer", () => {
  test("reads the trailers by name, wherever they sit in the message", () => {
    const message = [
      "docs: pin a message to the fence",
      "",
      "Some prose about the change.",
      "",
      "Grapht-Artifacts: docs/example.md, docs/example.md.board.json",
      "Grapht-Messages: aaa,bbb",
    ].join("\n")
    expect(parseCommitTrailers(message)).toEqual({
      artifacts: ["docs/example.md", "docs/example.md.board.json"],
      messages: ["aaa", "bbb"],
    })
    expect(parseCommitTrailers("chore: nothing to do with grapht")).toEqual({ artifacts: [], messages: [] })
    expect(parseCommitTrailers("Grapht-Messages:")).toEqual({ artifacts: [], messages: [] })
  })

  test("renders only the trailers it was given", () => {
    expect(renderCommitTrailers({ artifacts: ["a.md"], messages: ["aaa"] })).toBe(
      "Grapht-Artifacts: a.md\nGrapht-Messages: aaa",
    )
    expect(renderCommitTrailers({ artifacts: [], messages: ["aaa"] })).toBe("Grapht-Messages: aaa")
    expect(renderCommitTrailers({ artifacts: [], messages: [] })).toBe("")
    expect(parseCommitTrailers(renderCommitTrailers({ artifacts: ["b.md"], messages: ["bbb"] }))).toEqual({
      artifacts: ["b.md"],
      messages: ["bbb"],
    })
  })

  test("scopes the commits to the artifact and the messages about it", () => {
    const commits = [
      commit("r1", "2026-09-01T10:00:00Z", [], ["docs/example.md"]),
      commit("r2", "2026-09-02T10:00:00Z", ["m1"]),
      commit("r3", "2026-09-03T10:00:00Z", ["other"], ["docs/elsewhere.md"]),
    ]
    expect(trailerCommitsFor(commits, "docs/example.md", new Set(["m1"])).map(it => it.revisionId)).toEqual(["r1", "r2"])
    expect(trailerCommitsFor(commits, "docs/nowhere.md", new Set(["other"])).map(it => it.revisionId)).toEqual(["r3"])
  })

  test("measures each message between the revision it was written against and the one that resolved it", async () => {
    const document = mdDocument("docs/example.md", TEXT)
    const address = await addressAt(document, 2)
    const message = withMessageId({
      thread: "t1",
      author: { kind: "human", id: "chris" },
      at: "2026-09-02T10:00:00.000Z",
      kind: "note",
      target: address,
      body: "This paragraph is doing two jobs.",
      baseRevision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    })
    const log = { format: "grapht-messages/0" as const, artifact: "docs/example.md", messages: [message] }

    // Earlier commits that do not name it do not resolve it; the first one after it does.
    const commits = [
      commit("r0", "2026-09-01T10:00:00Z", [], ["docs/example.md"]),
      commit("r1", "2026-09-03T10:00:00Z", [message.id]),
      commit("r2", "2026-09-04T10:00:00Z", [message.id]),
    ]
    const lifecycles = messageLifecycles(log, commits)
    expect(lifecycles).toEqual([
      {
        message,
        writtenAgainst: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        resolvedBy: "r1",
      },
    ])

    // A commit written before the message cannot be what resolved it.
    const tooEarly = messageLifecycles(log, [commit("r9", "2026-08-01T10:00:00Z", [message.id])])
    expect(tooEarly[0]?.resolvedBy).toBeUndefined()
    expect(docHistoryAnomalies(log, [commit("r9", "2026-08-01T10:00:00Z", [message.id])])).toEqual([
      `message ${message.id} is resolved by r9, which predates it`,
    ])
  })

  test("compares stamps as instants, not as strings", async () => {
    const document = mdDocument("docs/example.md", TEXT)
    const address = await addressAt(document, 2)
    const message = withMessageId({
      thread: "t1",
      author: { kind: "human", id: "chris" },
      at: "2026-09-02T10:00:00.000Z",
      kind: "note",
      target: address,
      body: "Worth splitting.",
    })
    const log = { format: "grapht-messages/0" as const, artifact: "docs/example.md", messages: [message] }

    // A commit inside the message's own second still resolves it: git stamps to the second and the
    // message does not, so the commit that follows by 600ms reads as earlier at full precision.
    const sameSecond = { ...message, at: "2026-09-02T10:00:00.600Z" }
    const same = commit("rs", "2026-09-02T10:00:00+00:00", [message.id])
    const sameSecondLog = { ...log, messages: [sameSecond] }
    expect(messageLifecycles(sameSecondLog, [same])[0]?.resolvedBy).toBe("rs")
    expect(docHistoryAnomalies(sameSecondLog, [same])).toEqual([])

    // 04:00-07:00 is 11:00Z: an hour after the message, but earlier than it as a string.
    const after = commit("r1", "2026-09-02T04:00:00-07:00", [message.id])
    expect(messageLifecycles(log, [after])[0]?.resolvedBy).toBe("r1")
    expect(docHistoryAnomalies(log, [after])).toEqual([])

    // 01:00-07:00 is 08:00Z: genuinely before it.
    const before = commit("r0", "2026-09-02T01:00:00-07:00", [message.id])
    expect(messageLifecycles(log, [before])[0]?.resolvedBy).toBeUndefined()
    expect(docHistoryAnomalies(log, [before])).toEqual([`message ${message.id} is resolved by r0, which predates it`])
  })

  test("prints one line per message, and names what the join contradicts", async () => {
    const document = mdDocument("docs/example.md", TEXT)
    const address = await addressAt(document, 2)
    const message = withMessageId({
      thread: "t1",
      author: { kind: "agent", id: "claude", model: "opus" },
      at: "2026-09-02T10:00:00.000Z",
      kind: "proposal",
      target: address,
      body: "Split this paragraph.",
    })
    const log = { format: "grapht-messages/0" as const, artifact: "docs/example.md", messages: [message] }
    const resolved = commit("abcdef1234567890", "2026-09-03T10:00:00Z", [message.id], ["docs/example.md"])

    const lines = docHistoryLines(log, [resolved], new Map([[message.id, { state: "reanchored", address, previousSpan: address.span } as const]]))
    expect(lines).toEqual([
      [
        message.id.slice(0, 8),
        "agent:claude",
        `address:${address.locatorHash}`,
        "reanchored",
        "wrote-against -",
        "resolved-by abcdef12",
      ].join("  "),
    ])
    expect(anchorLabelOf({ state: "orphaned", reason: "ambiguous" })).toBe("orphaned (ambiguous)")
    expect(anchorLabelOf({ state: "unaddressable", reason: "board" })).toBe("unaddressable (board)")

    expect(docHistoryAnomalies(log, [resolved, commit("r9", "2026-09-03T10:00:00Z", ["gone"])])).toEqual([
      "commit r9 names message gone, which this log does not hold",
    ])
    expect(docHistoryAnomalies(log, [resolved])).toEqual([])
  })
})