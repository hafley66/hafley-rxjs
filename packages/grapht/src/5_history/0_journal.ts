import { createHash } from "node:crypto"

// The journal is self-contained: it carries each revision's content, so a
// consumer reconstructs any revision without git or the repository present.
export type HistoryRevision = {
  artifactId: string
  revisionId: string
  parentRevisionIds: readonly string[]
  /** sha256 of `content`, so consumers verify what they read. */
  contentHash: string
  /** Commit timestamp in ISO 8601, from the ingest, not from reading time. */
  capturedAt: string
  message: string
  path: string
  content: string
}

export type HistoryJournal = {
  format: "grapht-history/0"
  artifactId: string
  path: string
  /** Oldest first, so parents always precede children. */
  revisions: readonly HistoryRevision[]
}

export function contentHashOf(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex")
}

/** Serializes the journal as JSON Lines, one revision per line under a header line. */
export function journalToJsonl(journal: HistoryJournal): string {
  const header = JSON.stringify({
    format: journal.format,
    artifactId: journal.artifactId,
    path: journal.path,
  })
  return [header, ...journal.revisions.map(revision => JSON.stringify(revision))].join("\n") + "\n"
}

export function jsonlToJournal(text: string): HistoryJournal {
  const lines = text.split("\n").filter(line => line.trim().length > 0)
  if (lines.length === 0) throw new Error("history journal is empty")
  const header = JSON.parse(lines[0] as string) as { format: string; artifactId: string; path: string }
  if (header.format !== "grapht-history/0") throw new Error(`unknown history journal format: ${header.format}`)
  const revisions = lines.slice(1).map(line => JSON.parse(line) as HistoryRevision)
  for (const [index, revision] of revisions.entries()) {
    if (revision.contentHash !== contentHashOf(revision.content)) {
      throw new Error(`revision ${revision.revisionId} at line ${index + 2} fails its content hash`)
    }
  }
  return { format: "grapht-history/0", artifactId: header.artifactId, path: header.path, revisions }
}

/** Names structural defects: duplicate revisions and out-of-order capture times. */
export function journalAnomalies(journal: HistoryJournal): readonly string[] {
  const anomalies: string[] = []
  const seen = new Set<string>()
  let lastCapturedAt = ""
  for (const revision of journal.revisions) {
    if (seen.has(revision.revisionId)) anomalies.push(`duplicate revision ${revision.revisionId}`)
    if (revision.capturedAt < lastCapturedAt) {
      anomalies.push(`revision ${revision.revisionId} is captured before its predecessor`)
    }
    lastCapturedAt = revision.capturedAt
    seen.add(revision.revisionId)
  }
  return anomalies
}
