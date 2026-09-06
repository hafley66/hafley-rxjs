// playwright direct in node realm. beforeAll: vite prod build + preview server + chromium. No unifying layer.
import { build, preview, type PreviewServer } from 'vite'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll } from 'vitest'
import { trace } from '@opentelemetry/api'
import { Logger } from '../../src/index'
const log = Logger(import.meta.url)
const tracer = trace.getTracer('lab.e2e')

export function liveApp(traceName: string) {
  let server: PreviewServer, browser: Browser, page: Page, url: string
  beforeAll(async () => {
    await tracer.startActiveSpan('e2e.vite.build', async (s) => { await build({ configFile: 'fixtures/vite.app.config.ts' }); s.end() })
    server = await tracer.startActiveSpan('e2e.vite.preview', async (s) => { const p = await preview({ configFile: 'fixtures/vite.app.config.ts', preview: { port: 0 } }); s.end(); return p })
    url = server.resolvedUrls!.local[0] + 'app.html'
    browser = await tracer.startActiveSpan('e2e.chromium.launch', async (s) => { const b = await chromium.launch(); s.end(); return b })
    const ctx = await browser.newContext()
    await ctx.tracing.start({ screenshots: true, snapshots: true })
    page = await ctx.newPage()
    page.on('console', m => log.debug('page console [{type}] {text}', { type: m.type(), text: m.text() }))
    log.info('live app at {url}', { url })
  })
  afterAll(async () => {
    await page.context().tracing.stop({ path: `out/pw-trace-${traceName}.zip` })
    await browser.close(); await server.close()
    // playwright DEBUG_FILE is a fs WriteStream: give it a tick before the worker exits
    await new Promise(r => setTimeout(r, 150))
  })
  return { page: () => page, url: () => url }
}
