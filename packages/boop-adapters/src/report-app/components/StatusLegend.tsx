// Header button + popover explaining each status dot color, sourced from lib/status.ts so the
// legend and the per-row dot title never list different words.
import { GearButton, PopoverPanel } from "@hafley66/report-shell"
import { STATUS_LEGEND } from "../../lib/status.js"

export function StatusLegend() {
  return (
    <>
      <GearButton id="status-legend-gear" popoverTargetId="status-legend-popover" label="status ⓘ" title="status color legend" />
      <PopoverPanel id="status-legend-popover" className="status-legend">
        {STATUS_LEGEND.map((entry) => (
          <div className="status-legend-row" key={entry.word}>
            <span className={`dot ${entry.word}`} />
            <b>{entry.word}</b>
            <span className="status-legend-def">{entry.definition}</span>
          </div>
        ))}
      </PopoverPanel>
    </>
  )
}
