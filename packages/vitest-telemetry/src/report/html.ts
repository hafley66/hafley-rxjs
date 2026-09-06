// Event[] -> out/report.html. One self-contained file, built by vite.report.config.ts from
// src/report-app into dist/report-template.html. This just fills in the data blob.
import { readFileSync } from 'node:fs'
import type { Event } from './timeline.js'

const TEMPLATE_URL = new URL('../report-template.html', import.meta.url)
const PLACEHOLDER = '__VITEST_TELEMETRY_DATA__'

export function renderReport(events: Event[]): string {
  const data = { generated: new Date().toISOString(), rows: events }
  // "</" inside a <script> block would end the block early.
  const inlineJson = JSON.stringify(data).replace(/<\//g, '<\\/')
  const template = readFileSync(TEMPLATE_URL, 'utf8')
  if (!template.includes(PLACEHOLDER)) {
    throw new Error(`report-template.html is missing the ${PLACEHOLDER} placeholder`)
  }
  return template.replace(PLACEHOLDER, () => inlineJson)
}
