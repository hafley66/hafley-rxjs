// Title/summary/failure box above the events panel, plus the × that clears the selection and the pivot stack.
import { SignalReact } from '@hafley66/signals/react'
import { Truncated, formatDuration } from '@hafley66/report-shell'
import { clearSelection, verdictOf, type Model } from '../model'

function TitleView({ model }: { model: Model }) {
  const { file, test } = model.selected.$()
  if (!file) {
    return (
      <div className="top">
        <h2>no test selected</h2>
        <p className="summary">pick a test from the nav to see its timeline</p>
      </div>
    )
  }
  const events = model.eventsForSelected.$()
  const verdict = test ? verdictOf(model.verdicts.$(), file, test) : null
  const first = events[0]
  const realms = [...new Set(events.map((e) => e.realm))].join(', ')
  const traceIds = events.map((e) => e.traceId).filter((id): id is string => Boolean(id))
  const traces = [...new Set(traceIds)].map((id) => id.slice(0, 8)).join(', ')

  return (
    <div className="top">
      <h2>
        <Truncated className="title-text" text={test ? `${file} › ${test}` : file} />
        {verdict && (
          <small>
            <span className={`dot ${verdict.status}`} /> {verdict.status} {formatDuration(verdict.durationMs)}
          </small>
        )}
        <button type="button" className="title-close" title="clear selection" onClick={() => clearSelection(model)}>
          ×
        </button>
      </h2>
      {first && (
        <p className="summary">
          shard {first.shard ?? '-'} · project {first.project ?? '-'} · realms {realms} · {events.length} events · trace {traces}
        </p>
      )}
      {model.defaultViewHint.$() && (
        <p className="default-view-hint" data-testid="default-view-hint">
          showing the first failing test; other branches start collapsed, click anything to dismiss
        </p>
      )}
      {verdict?.failure && (
        <div className="failure" data-testid="failure">
          {verdict.failure}
        </div>
      )}
    </div>
  )
}

export const Title = SignalReact(TitleView)
