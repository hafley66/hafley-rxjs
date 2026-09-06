// Verdict lookup shared by model.ts and adapter/navTree.ts; lives here so neither imports the
// other (was duplicated inline in both before this pass, to dodge that cycle).
import type { Event } from '../../report/timeline.js'

export type Verdict = { status: Event['status'] | 'none'; durationMs: number; failure: string | null }

export function buildVerdicts(rows: Event[]): Map<string, Verdict> {
  const verdicts = new Map<string, Verdict>()
  for (const e of rows) {
    if (e.kind !== 'verdict') continue
    verdicts.set(`${e.file}::${e.test}`, { status: e.status ?? 'none', durationMs: e.durationMs ?? 0, failure: e.failure ?? null })
  }
  return verdicts
}

export function verdictOf(verdicts: Map<string, Verdict>, file: string, test: string): Verdict {
  return verdicts.get(`${file}::${test}`) ?? { status: 'none', durationMs: 0, failure: null }
}
