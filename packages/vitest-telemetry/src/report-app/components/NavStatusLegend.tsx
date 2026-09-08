// Legend + column picker popover for the nav grid. TreeColumn.header is a plain string with no
// renderer slot (grid backlog), so this overlays an icon-only trigger at the status column's fixed slot.
import type { Grid } from '@hafley66/grid'
import { ColumnVisibilityToolbar } from '@hafley66/grid/react'
import { GearButton, PopoverPanel } from '@hafley66/report-shell'
import type { NavNode } from '../model'
import { DURATION_COLUMN_WIDTH, EVENTS_COLUMN_WIDTH } from './NavColumns'

export function NavStatusLegend({ grid }: { grid: Grid<NavNode> }) {
  return (
    <div className="nav-status-legend" style={{ right: DURATION_COLUMN_WIDTH + EVENTS_COLUMN_WIDTH }}>
      <GearButton id="status-legend-gear" popoverTargetId="status-legend-popover" label="ⓘ" title="status legend" className="status-legend-trigger" />
      <PopoverPanel id="status-legend-popover" className="status-legend-popover">
        <fieldset>
          <legend>status legend</legend>
          <p><span className="dot pass" /> pass: the test passed</p>
          <p><span className="dot fail" /> fail: the test failed</p>
          <p><span className="dot skip" /> skip: the test was skipped</p>
          <p><span className="dot" /> none: no verdict recorded</p>
          <p className="status-legend-hint">alt-click the status dot to pivot on it</p>
        </fieldset>
        <fieldset>
          <legend>columns</legend>
          <ColumnVisibilityToolbar grid={grid} />
        </fieldset>
      </PopoverPanel>
    </div>
  )
}
