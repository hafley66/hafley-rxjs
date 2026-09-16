// Git as the save points, with no second database. A commit that writes messages says so in its
// trailer; the message itself says which revision it was written against. Everything the history
// view prints is a join of those two facts over the log, so nothing has to be kept in sync.
//
// The trailer is the plan's:
//
//   Grapht-Artifacts: docs/example.md,docs/example.md.board.json
//   Grapht-Messages: <id>,<id>
import { type DocMessage, type MessageAnchorState, type MessageLog, targetKeyOf } from "../6_messages/0_messageLog.js"

export const ARTIFACTS_TRAILER = "Grapht-Artifacts"
export const MESSAGES_TRAILER = "Grapht-Messages"

export type CommitTrailers = {
  artifacts: readonly string[]
  /** Message ids this commit closes or resolves. */
  messages: readonly string[]
}

/** One commit, as much of it as the history view needs. */
export type TrailerCommit = { revisionId: string; at: string; trailers: CommitTrailers }

export type MessageLifecycle = {
  message: DocMessage
  /** The revision the author was looking at, when they said. */
  writtenAgainst: string | undefined
  /** The first commit after it that names the message in its trailer. */
  resolvedBy: string | undefined
}

const TRAILER_LINE = /^Grapht-(Artifacts|Messages):\s*(.*)$/

/**
 * Two ISO 8601 stamps are only comparable as instants, and only to the second.
 *
 * As strings they are not comparable at all: git writes an author date with the author's offset
 * (`-04:00`) while a message may be stamped `Z`, and the same moment then reads as two different
 * places. As instants they still disagree below the second, because git stamps to the second and a
 * message carries milliseconds — so a message written 300ms before the commit that resolves it
 * would look resolved before it was written. Sub-second precision is not evidence here, so neither
 * comparison is made at that resolution.
 */
const instantOf = (at: string): number => Math.floor(Date.parse(at) / 1000) * 1000

const valuesOf = (line: string): readonly string[] =>
  line
    .split(",")
    .map(value => value.trim())
    .filter(value => value.length > 0)

/**
 * The trailers a commit message carries. Read by name rather than by position, so a message that
 * puts its trailer block somewhere unusual still parses.
 */
export function parseCommitTrailers(commitMessage: string): CommitTrailers {
  const artifacts: string[] = []
  const messages: string[] = []
  for (const line of commitMessage.split("\n")) {
    const match = TRAILER_LINE.exec(line.trim())
    if (!match) continue
    const values = valuesOf(match[2] as string)
    if (match[1] === "Artifacts") artifacts.push(...values)
    else messages.push(...values)
  }
  return { artifacts, messages }
}

/** The trailer block a writer appends to a commit message; empty lists are left out entirely. */
export function renderCommitTrailers(trailers: CommitTrailers): string {
  const lines: string[] = []
  if (trailers.artifacts.length > 0) lines.push(`${ARTIFACTS_TRAILER}: ${trailers.artifacts.join(",")}`)
  if (trailers.messages.length > 0) lines.push(`${MESSAGES_TRAILER}: ${trailers.messages.join(",")}`)
  return lines.join("\n")
}

/** The commits that mention this log at all: by the artifact they name, or by a message id. */
export function trailerCommitsFor(
  commits: readonly TrailerCommit[],
  artifact: string,
  ids: ReadonlySet<string>,
): readonly TrailerCommit[] {
  return commits.filter(
    commit =>
      commit.trailers.artifacts.includes(artifact) ||
      commit.trailers.messages.some(id => ids.has(id)),
  )
}

/** Written against, resolved by: the two revisions a message's life is measured between. */
export function messageLifecycles(log: MessageLog, commits: readonly TrailerCommit[]): readonly MessageLifecycle[] {
  const ordered = [...commits].sort((left, right) => instantOf(left.at) - instantOf(right.at))
  return log.messages.map(message => {
    const resolved = ordered.find(
      commit => commit.trailers.messages.includes(message.id) && instantOf(commit.at) >= instantOf(message.at),
    )
    return { message, writtenAgainst: message.baseRevision, resolvedBy: resolved?.revisionId }
  })
}

/**
 * What the join says that cannot be true: a message the log does not hold, a resolution that
 * predates what it resolved, and whatever the log already says about itself. A `baseRevision`
 * outside the walked commits is not listed here, because a walk can be narrower than history.
 */
export function docHistoryAnomalies(log: MessageLog, commits: readonly TrailerCommit[]): readonly string[] {
  const anomalies: string[] = []
  const ids = new Set(log.messages.map(message => message.id))
  const byId = new Map(log.messages.map(message => [message.id, message]))

  for (const commit of commits) {
    for (const id of commit.trailers.messages) {
      if (!ids.has(id)) anomalies.push(`commit ${commit.revisionId} names message ${id}, which this log does not hold`)
    }
  }
  for (const message of log.messages) {
    for (const commit of commits) {
      if (commit.trailers.messages.includes(message.id) && instantOf(commit.at) < instantOf(message.at)) {
        anomalies.push(`message ${message.id} is resolved by ${commit.revisionId}, which predates it`)
      }
    }
    if (message.resolves !== undefined && !byId.has(message.resolves)) {
      anomalies.push(`message ${message.id} resolves ${message.resolves}, which this log does not hold`)
    }
  }
  return anomalies
}

/** How an anchor state reads in a history line: short, and never a guess. */
export function anchorLabelOf(state: MessageAnchorState): string {
  switch (state.state) {
    case "anchored":
      return "anchored"
    case "reanchored":
      return "reanchored"
    case "orphaned":
      return `orphaned (${state.reason})`
    case "unaddressable":
      return `unaddressable (${state.reason})`
  }
}

/**
 * One line per message: who said it, what it points at, where that is now, and the two revisions its
 * life is measured between. A caller that only wants the lines can ask for them without a repository.
 */
export function docHistoryLines(
  log: MessageLog,
  commits: readonly TrailerCommit[],
  states: ReadonlyMap<string, MessageAnchorState>,
): readonly string[] {
  return messageLifecycles(log, commits).map(({ message, writtenAgainst, resolvedBy }) => {
    const state = states.get(message.id)
    return [
      message.id.slice(0, 8),
      message.author.kind === "human" ? `human:${message.author.id}` : `agent:${message.author.id}`,
      targetKeyOf(message.target),
      state ? anchorLabelOf(state) : "unknown",
      `wrote-against ${writtenAgainst?.slice(0, 8) ?? "-"}`,
      `resolved-by ${resolvedBy?.slice(0, 8) ?? "-"}`,
    ].join("  ")
  })
}
