// What was said about which bytes. A message names an author, a time, and a target, and the target
// is an address — so a note pinned to a paragraph is a record about that paragraph, not about a
// screen position, and it survives editing the way an address does.
//
// Same discipline as the history journal: one header line carrying the format, one record per line,
// and reading verifies rather than trusts. A message's id is derived from the tuple it was written
// with, so a rewritten body is a different message, and reading catches a file whose id does not
// match its own contents.
import { createHash } from "node:crypto"
import { type MdAddress, type MdDocument, type SourceSpan, relocateAddress } from "@hafley66/grapht-model"
import { writeArtifactFile } from "../lib/2_artifactFile.js"
import { readFileSync } from "node:fs"

export const MESSAGE_LOG_FORMAT = "grapht-messages/0"

export type MessageAuthor =
  | { kind: "human"; id: string }
  | { kind: "agent"; id: string; model: string; session?: string }

export type MessageKind = "note" | "question" | "proposal" | "patch" | "verdict"

/** Prose, a board item, or one part of a rendered diagram. A bare `MdAddress` is the prose case. */
export type MessageTarget =
  | MdAddress
  | { kind: "board"; boardId: string; itemId: string }
  | { kind: "part"; path: string; locatorHash: string; elementId: string }

export type DocMessage = {
  /** sha256 of (author | at | target | body): derived, never authored. */
  id: string
  /** Thread root id; the message's own id when it opens one. */
  thread: string
  replyTo?: string
  author: MessageAuthor
  /** ISO 8601. */
  at: string
  kind: MessageKind
  target: MessageTarget
  body: string
  /** The git commit the author was looking at, when they had one. */
  baseRevision?: string
  /** The message this one closes. */
  resolves?: string
}

export type MessageLog = {
  format: typeof MESSAGE_LOG_FORMAT
  artifact: string
  messages: readonly DocMessage[]
}

export type MessageAnchorState =
  | { state: "anchored"; address: MdAddress }
  | { state: "reanchored"; address: MdAddress; previousSpan: SourceSpan }
  | { state: "orphaned"; reason: "missing" | "ambiguous" }
  | { state: "unaddressable"; reason: "board" | "part" | "no-document" }

const authorKeyOf = (author: MessageAuthor): string =>
  author.kind === "human" ? `human:${author.id}` : `agent:${author.id}:${author.model}`

/** Where a target points, with no body in it: the join key two messages about the same bytes share. */
export function targetKeyOf(target: MessageTarget): string {
  if ("kind" in target) {
    return target.kind === "board"
      ? `board:${target.boardId}#${target.itemId}`
      : `part:${target.path}#${target.locatorHash}#${target.elementId}`
  }
  return `address:${target.locatorHash}`
}

/** The id a message is written under: the same tuple always hashes the same, and any of it changes the id. */
export function messageIdOf(message: Omit<DocMessage, "id">): string {
  return createHash("sha256")
    .update([authorKeyOf(message.author), message.at, targetKeyOf(message.target), message.body].join("\u0000"), "utf8")
    .digest("hex")
}

/** A draft with its id filled in — what a writer actually calls. */
export function withMessageId(draft: Omit<DocMessage, "id">): DocMessage {
  return { ...draft, id: messageIdOf(draft) }
}

/** The log beside its artefact, committed with it. */
export function messageLogPathFor(artifact: string): string {
  if (artifact.length === 0) throw new Error("a message log needs the artefact it sits beside")
  return `${artifact}.messages.jsonl`
}

/** One header line, then one message per line. */
export function messagesToJsonl(log: MessageLog): string {
  const header = JSON.stringify({ format: log.format, artifact: log.artifact })
  return `${[header, ...log.messages.map(message => JSON.stringify(message))].join("\n")}\n`
}

/** Reads a log and refuses one whose records do not hash to the ids they claim. */
export function jsonlToMessages(text: string): MessageLog {
  const lines = text.split("\n").filter(line => line.trim().length > 0)
  if (lines.length === 0) throw new Error("message log is empty")
  const header = JSON.parse(lines[0] as string) as { format: string; artifact: string }
  if (header.format !== MESSAGE_LOG_FORMAT) throw new Error(`unknown message log format: ${header.format}`)

  const messages = lines.slice(1).map((line, index) => {
    const record = JSON.parse(line) as DocMessage
    const { id, ...rest } = record
    if (messageIdOf(rest) !== id) throw new Error(`message at line ${index + 2} fails its own id`)
    return record
  })
  return { format: MESSAGE_LOG_FORMAT, artifact: header.artifact, messages }
}

/**
 * Names what is structurally wrong without reading a single body: two messages under one id, a reply
 * to something the log does not hold, and a time that runs backwards.
 */
export function messageAnomalies(log: MessageLog): readonly string[] {
  const anomalies: string[] = []
  const ids = new Set(log.messages.map(message => message.id))
  const seen = new Set<string>()
  let lastAt = ""
  for (const message of log.messages) {
    if (seen.has(message.id)) anomalies.push(`duplicate message ${message.id}`)
    // Order-independent: a reply may be written before the message it answers.
    if (message.replyTo !== undefined && !ids.has(message.replyTo)) {
      anomalies.push(`message ${message.id} replies to ${message.replyTo}, which this log does not hold`)
    }
    // Instants, not strings: two stamps in different offsets are not comparable character by character.
    if (lastAt !== "" && Date.parse(message.at) < Date.parse(lastAt)) {
      anomalies.push(`message ${message.id} is written before its predecessor`)
    }
    lastAt = message.at
    seen.add(message.id)
  }
  return anomalies
}

/**
 * Where a message's target is now. Prose targets relocate by address, exactly as a board item does;
 * a board or part target is not this module's to resolve, and says so rather than guessing.
 */
export async function messageAnchorState(
  message: DocMessage,
  documents: readonly MdDocument[],
): Promise<MessageAnchorState> {
  const target = message.target
  if ("kind" in target) return { state: "unaddressable", reason: target.kind }
  const document = documents.find(candidate => candidate.path === target.path)
  if (!document) return { state: "unaddressable", reason: "no-document" }

  const relocation = await relocateAddress(target, document)
  if (relocation.state === "anchored") return { state: "anchored", address: relocation.address }
  if (relocation.state === "reanchored") {
    return { state: "reanchored", address: relocation.address, previousSpan: relocation.previousSpan }
  }
  return { state: "orphaned", reason: relocation.reason }
}

/** Writes the log beside its artefact, whole or not at all. */
export function writeMessageLog(path: string, log: MessageLog): void {
  writeArtifactFile(path, messagesToJsonl(log))
}

/** Reads a log and returns it only when every record answers for itself. */
export function readMessageLog(path: string): MessageLog {
  const text = readFileSync(path, "utf8")
  try {
    return jsonlToMessages(text)
  } catch (error) {
    throw new Error(`message log ${path}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
}