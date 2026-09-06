// Every consumer derives its status word through this file; no inline running/waiting/idle logic.
export type ExitStatus = "ok" | "error" | "unknown"
export type StatusWord = "running" | "waiting" | "idle" | "done" | "failed" | "unknown"

// A session counts as "active" only inside this window; past it a live session is merely "idle".
export const ACTIVE_WINDOW_MS = 60 * 60 * 1000

export type StatusFrame = { t: number; direction: "in" | "out" | "self"; peer: string | null }

export type StatusInput = {
  live: boolean
  closedTs: number | null
  exitStatus: ExitStatus
  lastActivityTs: number | null
  frames: StatusFrame[]
  now: number
}

function lastFrameOf(frames: StatusFrame[]): StatusFrame | null {
  if (!frames.length) return null
  return frames.reduce((latest, frame) => (frame.t > latest.t ? frame : latest))
}

export function isActive(input: { live: boolean; lastActivityTs: number | null; now: number }): boolean {
  if (!input.live || input.lastActivityTs === null) return false
  return input.now - input.lastActivityTs <= ACTIVE_WINDOW_MS
}

// "unknown" is reserved for real gaps in the source signal: an unresolved exit class, or a
// session that is neither live nor closed (a transitional row the store hasn't settled yet).
export function deriveStatus(input: StatusInput): StatusWord {
  const { live, closedTs, exitStatus, frames } = input
  if (closedTs !== null) {
    if (exitStatus === "error") return "failed"
    if (exitStatus === "ok") return "done"
    return "unknown"
  }
  if (!live) return "unknown"
  if (!isActive(input)) return "idle"
  return lastFrameOf(frames)?.direction === "out" ? "waiting" : "running"
}

export function waitingOnPeer(frames: StatusFrame[]): string | null {
  const last = lastFrameOf(frames)
  return last && last.direction === "out" ? last.peer : null
}

// One line per dot color, shared by the row dot's title attribute and the header legend popover.
export const STATUS_LEGEND: { word: StatusWord; definition: string }[] = [
  { word: "running", definition: "active, and not currently waiting on a reply" },
  { word: "waiting", definition: "active, last frame sent out with no reply yet" },
  { word: "idle", definition: "live (pid attached), but no activity in the last hour" },
  { word: "done", definition: "closed, exited ok" },
  { word: "failed", definition: "closed, exited with an error" },
  { word: "unknown", definition: "none of the above; the source data doesn't say" },
]

export function statusDefinition(word: StatusWord): string {
  return STATUS_LEGEND.find((entry) => entry.word === word)?.definition ?? ""
}
