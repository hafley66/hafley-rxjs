import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { parseCommitTrailers, type TrailerCommit } from "./0_trailer.js"

const execFileAsync = promisify(execFile)

// 0x1e between commits and 0x00 between fields: a commit body is free text, so the separators have
// to be characters a person will not type.
const RECORD = "\x1e"

/**
 * Every commit that carries a Grapht trailer, oldest first, so a resolution can never be found out
 * of order. Reading the trailers is the whole job; nothing here opens a file or reads a message.
 */
export async function gitTrailerCommits(workingDirectory: string): Promise<readonly TrailerCommit[]> {
  const { stdout } = await execFileAsync(
    "git",
    ["log", "--reverse", "--date=iso-strict", `--pretty=format:%H%x00%aI%x00%B${RECORD}`],
    { cwd: workingDirectory, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  )

  const commits: TrailerCommit[] = []
  for (const record of stdout.split(RECORD)) {
    // `--pretty=format:` puts a newline *between* commits, so every record after the first opens
    // with one; left in, it lands inside the revision id.
    const [revisionId, at, message] = record.replace(/^[\r\n]+/, "").split("\x00")
    if (revisionId === undefined || at === undefined || message === undefined) continue
    const trailers = parseCommitTrailers(message)
    if (trailers.artifacts.length === 0 && trailers.messages.length === 0) continue
    commits.push({ revisionId, at, trailers })
  }
  return commits
}
