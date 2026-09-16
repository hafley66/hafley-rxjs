// grapht-doc-history <artifact>: every message written about a document or a board, with the
// revision it was written against and the revision that resolved it. Exit codes match
// grapht-history: 2 usage, 1 anomalies, 0 clean.
import { existsSync, readFileSync } from "node:fs"

import { mdDocument } from "@hafley66/grapht-model"
import { messageAnchorState, messageAnomalies, messageLogPathFor, readMessageLog } from "../6_messages/0_messageLog.js"
import { docHistoryAnomalies, docHistoryLines, trailerCommitsFor } from "./0_trailer.js"
import { gitTrailerCommits } from "./1_gitTrailers.js"

const USAGE = "usage: grapht-doc-history <artifact-path>\n"

export async function docHistoryMain(argv: readonly string[]): Promise<number> {
  const [artifact] = argv
  if (artifact === undefined) {
    process.stderr.write(USAGE)
    return 2
  }

  const logPath = messageLogPathFor(artifact)
  if (!existsSync(logPath)) {
    // A document nobody has written about yet is a normal state, not a failure.
    process.stdout.write(`0 messages (no log at ${logPath})\n`)
    return 0
  }

  let log: ReturnType<typeof readMessageLog>
  try {
    log = readMessageLog(logPath)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }

  const workingDirectory = process.cwd()
  let commits: Awaited<ReturnType<typeof gitTrailerCommits>>
  try {
    commits = await gitTrailerCommits(workingDirectory)
  } catch {
    process.stderr.write(`no git history in ${workingDirectory}\n`)
    return 1
  }
  const scoped = trailerCommitsFor(commits, artifact, new Set(log.messages.map(message => message.id)))

  // The artifact's current text is what decides whether an address still points at anything; a
  // missing or unreadable artifact leaves every quoted state unanswered rather than stale.
  let document: ReturnType<typeof mdDocument> | undefined
  try {
    document = mdDocument(artifact, readFileSync(artifact, "utf8"))
  } catch {
    document = undefined
  }

  const states = new Map<string, Awaited<ReturnType<typeof messageAnchorState>>>()
  for (const message of log.messages) {
    states.set(message.id, document ? await messageAnchorState(message, [document]) : { state: "unaddressable", reason: "no-document" })
  }

  const anomalies = [...messageAnomalies(log), ...docHistoryAnomalies(log, scoped)]
  for (const line of docHistoryLines(log, scoped, states)) process.stdout.write(`${line}\n`)
  for (const anomaly of anomalies) process.stderr.write(`${anomaly}\n`)
  process.stdout.write(`${log.messages.length} message(s), ${anomalies.length} anomaly(ies)\n`)
  return anomalies.length > 0 ? 1 : 0
}
