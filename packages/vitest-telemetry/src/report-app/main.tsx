// Parses the embedded data blob, creates the one model + prefs signal for the whole page, and
// mounts the React root. No module-level `let` state: everything lives on `model` or `prefs`.
import '@hafley66/report-shell/style.css'
import '@hafley66/report-shell/marbler.css'
import './style.css'
import { createRoot } from 'react-dom/client'
import type { Event } from '../report/timeline.js'
import { createModel, findFirstLeaf } from './model'
import { createPrefs } from './prefs'
import { App } from './components/App'

type ReportData = { generated: string; rows: Event[] }

function readData(): ReportData {
  const script = document.getElementById('data')
  return JSON.parse(script?.textContent ?? '{"generated":"","rows":[]}') as ReportData
}

function metaLine(data: ReportData): string {
  const verdicts = data.rows.filter((row) => row.kind === 'verdict')
  const failed = verdicts.filter((row) => row.status === 'fail').length
  return `${data.generated.slice(0, 19).replace('T', ' ')} · ${verdicts.length} tests · ${failed} failed · ${data.rows.length} events`
}

function main(): void {
  const data = readData()
  const model = createModel(data.rows)
  const prefs = createPrefs()

  if (!model.selected.$().file) {
    const failure = model.firstFailure.$()
    const selection = failure ?? findFirstLeaf(model.nav.$())
    if (selection) model.selected.$(selection)
    if (failure) model.defaultViewHint.$(true)
  }

  const root = document.getElementById('root')
  if (!root) throw new Error('missing #root')
  createRoot(root).render(<App model={model} prefs={prefs} meta={metaLine(data)} />)
}

main()
