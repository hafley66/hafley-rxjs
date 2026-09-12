import { execFile } from "node:child_process"
import { realpathSync } from "node:fs"
import { relative, resolve } from "node:path"
import { promisify } from "node:util"

import { contentHashOf, type HistoryJournal, type HistoryRevision } from "./0_journal.js"

const execFileAsync = promisify(execFile)

type CommitRecord = {
  revisionId: string
  parentRevisionIds: readonly string[]
  capturedAt: string
  message: string
}

// Runs at ingest time only; nothing here reaches a runtime.
export async function gitHistoryJournal(
  workingDirectory: string,
  path: string,
  artifactId = path,
): Promise<HistoryJournal> {
  const { stdout: logText } = await execFileAsync(
    "git",
    ["log", "--follow", "--reverse", "--date=iso-strict", "--pretty=format:%H%x00%P%x00%ad%x00%s", "--", path],
    { cwd: workingDirectory, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  )

  // `git show <rev>:<path>` resolves from the repository root while `git log`
  // pathspecs resolve from the working directory, so the walk carries both.
  const { stdout: toplevel } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], {
    cwd: workingDirectory,
    encoding: "utf8",
  })
  // realpath on both sides because macOS tmpdirs resolve through /var -> /private/var.
  const rootPath = relative(realpathSync(toplevel.trim()), realpathSync(resolve(workingDirectory, path)))

  const commits: CommitRecord[] = logText
    .split("\n")
    .filter(line => line.trim().length > 0)
    .map(line => {
      const [revisionId, parents, capturedAt, ...messageParts] = line.split("\x00")
      return {
        revisionId: revisionId as string,
        parentRevisionIds: (parents ?? "").split(" ").filter(Boolean),
        capturedAt: capturedAt as string,
        message: messageParts.join("\x00"),
      }
    })
  if (commits.length === 0) throw new Error(`no git history for ${path} in ${workingDirectory}`)

  const revisions: HistoryRevision[] = []
  for (const commit of commits) {
    let content: string
    try {
      const { stdout } = await execFileAsync("git", ["show", `${commit.revisionId}:${rootPath}`], {
        cwd: workingDirectory,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      })
      content = stdout
    } catch {
      // A commit that touched the path's rename chain before the file existed
      // under this name yields nothing; --follow listed it, so it is skipped.
      continue
    }
    revisions.push({
      artifactId,
      revisionId: commit.revisionId,
      parentRevisionIds: commit.parentRevisionIds,
      contentHash: contentHashOf(content),
      capturedAt: commit.capturedAt,
      message: commit.message,
      path,
      content,
    })
  }

  return { format: "grapht-history/0", artifactId, path, revisions }
}
