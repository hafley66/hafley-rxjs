// Title box above the events panel: selected session's own name, harness, cwd, branch, status.
import { SignalReact } from "@hafley66/signals/react"
import { Truncated } from "@hafley66/report-shell"
import { formatAge } from "../../lib/time.js"
import { deriveStatus, type StatusFrame } from "../../lib/status.js"
import { findNode, type Model } from "../model"

function TitleView({ model }: { model: Model }) {
  const selectedId = model.selected.$()
  if (!selectedId) {
    return (
      <div className="top">
        <h2>no session selected</h2>
        <p className="summary">pick a session from the nav to see its timeline</p>
      </div>
    )
  }
  const session = model.sessionById.$().get(selectedId)
  const node = findNode(model.networkTree.$(), selectedId)
  const now = Date.now()
  const frames: StatusFrame[] = (node?.frames ?? []).map((frame) => ({ t: frame.t, direction: frame.direction, peer: frame.peer }))
  const status = session
    ? deriveStatus({ live: session.live, closedTs: session.closedTs, exitStatus: session.exitStatus, lastActivityTs: session.lastActivityTs, frames, now })
    : null
  return (
    <div className="top">
      <h2>
        <Truncated className="title-text" text={node?.name ?? selectedId} />
        <button type="button" className="title-close" title="clear selection" onClick={() => model.selected.$(null)}>
          ×
        </button>
      </h2>
      {session && (
        <p className="summary" data-status={status ?? undefined}>
          {session.harness} · {session.cwd ?? "-"} · branch {session.branch || "-"} · opened{" "}
          {session.openedTs ? formatAge(session.openedTs, now) : "-"} ·{" "}
          {session.closedTs ? `closed ${formatAge(session.closedTs, now)}` : "live"} · {status}
          {session.tokens ? ` · ${session.tokens} tokens` : ""}
        </p>
      )}
    </div>
  )
}

export const Title = SignalReact(TitleView)
