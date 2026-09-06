// Frame-level detail for whichever row is selected in the marbler: one row per frame, columns
// age/kind/direction/peer/preview, through the shell's own SubTable and Truncated primitives.
import { SignalReact } from "@hafley66/signals/react"
import { SubTable, Truncated } from "@hafley66/report-shell"
import { formatAge } from "../../lib/time.js"
import { findNode, type Model } from "../model"

const COLUMNS = ["age", "kind", "direction", "peer", "preview"]

function FrameDetailView({ model }: { model: Model }) {
  const id = model.marbler.selectedId.$()
  const node = id ? findNode(model.marbler.rows.$(), id) : undefined
  const frames = node?.frames ?? []
  if (!frames.length) return null
  const now = Date.now()
  const rows = frames.map((frame) => [
    formatAge(frame.t, now),
    frame.kind,
    frame.direction,
    frame.peer ?? "",
    <Truncated key={frame.id} text={frame.preview} />,
  ])
  return (
    <div className="frame-detail" data-testid="frame-detail">
      <h4>frames</h4>
      <SubTable columns={COLUMNS} rows={rows} />
    </div>
  )
}

export const FrameDetail = SignalReact(FrameDetailView)
