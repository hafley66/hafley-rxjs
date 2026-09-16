import { DatabaseSync } from "node:sqlite"
import type { PageObservationEvent } from "./0_controls.js"

export type ClickRecord = {
  sequence: number
  timestamp: number
  url: string
  playwrightSelector: string | null
  candidates: string[]
  path: { tag: string; role: string | null; name: string | null; id: string | null }[]
  text: string | null
}

/**
 * Persists recorded clicks so a human can click through a flow and then hand a model the targets to
 * automate, without the model parsing the DOM. Clicks arrive as `source: "click"` observation events.
 */
export class ClickLog {
  database: DatabaseSync
  constructor({ path }: { path: string }) {
    this.database = new DatabaseSync(path)
    this.database.exec(`
      create table if not exists clicks (
        sequence integer primary key autoincrement,
        timestamp integer not null,
        url text not null,
        playwright_selector text,
        candidates text not null,
        path text not null,
        text text
      )
    `)
  }
  record(events: PageObservationEvent[], { url = "" }: { url?: string } = {}): number {
    const insert = this.database.prepare(
      "insert into clicks (timestamp, url, playwright_selector, candidates, path, text) values (?, ?, ?, ?, ?, ?)",
    )
    let recorded = 0
    for (const event of events) {
      if (event.source !== "click") continue
      insert.run(
        event.timestamp,
        url,
        event.playwrightSelector ?? null,
        JSON.stringify(event.candidates ?? []),
        JSON.stringify(event.path ?? []),
        event.text ?? null,
      )
      recorded++
    }
    return recorded
  }
  /** Most recent clicks, newest first unless `oldestFirst` is set. */
  recent(limit = 5, { oldestFirst = false }: { oldestFirst?: boolean } = {}): ClickRecord[] {
    const rows = this.database
      .prepare(
        `select sequence, timestamp, url, playwright_selector, candidates, path, text
         from clicks order by sequence desc limit ?`,
      )
      .all(limit) as Record<string, unknown>[]
    const records = rows.map(row => ({
      sequence: Number(row.sequence),
      timestamp: Number(row.timestamp),
      url: String(row.url),
      playwrightSelector: row.playwright_selector == null ? null : String(row.playwright_selector),
      candidates: JSON.parse(String(row.candidates)) as string[],
      path: JSON.parse(String(row.path)) as ClickRecord["path"],
      text: row.text == null ? null : String(row.text),
    }))
    return oldestFirst ? records.reverse() : records
  }
  unsubscribe() {
    this.database.close()
  }
}
