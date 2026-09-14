// Measure animation-frame delivery during repeatable wheel input; this is not display-presented FPS.
import { build, preview } from 'vite'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
const root = fileURLToPath(new URL('.', import.meta.url))
const outDir = '/private/tmp/grapht-frames-build'
await build({ configFile: false, root, build: { outDir, emptyOutDir: true, target: 'esnext' }, logLevel: 'error' })
const server = await preview({ configFile: false, root, build: { outDir }, preview: { host: '127.0.0.1', port: 0 } })
const results = []
try {
 for (const copies of [1, 8, 32, 128]) for (let trial = 0; trial < 2; trial++) for (const mode of trial % 2 ? ['cytoscape','document'] : ['document','cytoscape']) {
  const browser = await chromium.launch({ headless: true })
  try {
   const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
   await page.goto(`${server.resolvedUrls.local[0]}?mode=${mode}&copies=${copies}`)
   await page.waitForFunction(() => window.benchmark)
   await page.evaluate(async () => { await window.benchmark.prepare(); window.benchmark.mount() })
   const cdp = await page.context().newCDPSession(page)
   await cdp.send('HeapProfiler.collectGarbage')
   for (const gesture of ['pan','zoom']) {
    const sample = await page.evaluate(async gesture => {
     await new Promise(resolve => setTimeout(resolve, 750))
     const host = document.querySelector('#host')
     let events = 0
     const started = performance.now()
     const timer = setInterval(() => {
      const direction = Math.floor((performance.now() - started) / 500) % 2 ? -1 : 1
      host.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 640, clientY: 400, deltaY: direction * (gesture === 'zoom' ? 2 : 8), ctrlKey: gesture === 'zoom' }))
      events++
     }, 16)
     const sample = await window.benchmark.measureFrames()
     clearInterval(timer)
     return { ...sample, events, ...window.benchmark.counts() }
    }, gesture)
    const result = { copies, messages: copies * 125, mode, trial, gesture, browser: browser.version(), ...sample }
    results.push(result)
    writeFileSync(new URL('6_frames.json', import.meta.url), JSON.stringify(results, null, 2)+'\n')
    console.log(JSON.stringify(result))
   }
  } finally { await browser.close() }
 }
} finally { await new Promise(resolve => server.httpServer.close(resolve)) }
