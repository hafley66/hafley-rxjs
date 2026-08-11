import { Application, Container, Graphics } from "pixi.js"
import { animationFrameScheduler, auditTime, interval, lastValueFrom, map, takeUntil, tap, timer, toArray } from "rxjs"
import { describe, expect, it } from "vitest"

const DURATION_MS = 10_000
const SOURCE_INTERVAL_MS = 10
const EVENTS_PER_CHANGE = 10
const PHASES_PER_EVENT = 4
const ROWS = 80

type Receipt = { drawMs: number; events: number; phases: number }

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0
}

describe("Pixi retained temporal renderer", () => {
  it("measures a ten-second append and camera-change run", { timeout: 30_000 }, async () => {
    const host = document.createElement("div")
    host.style.width = "1200px"
    host.style.height = "600px"
    document.body.append(host)

    const app = new Application()
    await app.init({ width: 1200, height: 600, autoStart: false, antialias: false, preference: "webgl" })
    host.append(app.canvas)
    const world = new Container({ isRenderGroup: true })
    app.stage.addChild(world)

    let requestedChanges = 0
    let appendedEvents = 0
    let appendedPhases = 0
    let retainedBatches = 0
    const startedAt = performance.now()

    const changes$ = interval(SOURCE_INTERVAL_MS).pipe(
      takeUntil(timer(DURATION_MS)),
      map((tick) => {
        const batch = new Graphics()
        for (let eventIndex = 0; eventIndex < EVENTS_PER_CHANGE; eventIndex++) {
          const event = appendedEvents + eventIndex
          const x = event * 1.5
          const y = (event % ROWS) * 7.5
          batch.rect(x, y, 2, 5).fill(0xd59b47)
          batch.rect(x + 2, y, 5, 5).fill(0x8e57bc)
          batch.rect(x + 7, y, 2, 5).fill(0x3f8dbd)
          batch.rect(x + 9, y, 4, 5).fill(0x49a56b)
        }
        world.addChild(batch)
        requestedChanges++
        retainedBatches++
        appendedEvents += EVENTS_PER_CHANGE
        appendedPhases += EVENTS_PER_CHANGE * PHASES_PER_EVENT
        return { events: EVENTS_PER_CHANGE, phases: EVENTS_PER_CHANGE * PHASES_PER_EVENT, tick }
      }),
    )

    const receipts = await lastValueFrom(changes$.pipe(
      auditTime(0, animationFrameScheduler),
      tap(({ tick }) => {
        const elapsed = performance.now() - startedAt
        const worldWidth = Math.max(1200, appendedEvents * 1.5)
        world.scale.x = 1200 / worldWidth
        world.position.x = -Math.max(0, elapsed - 8000) * 0.01
        world.position.y = Math.sin(tick / 50) * 4
      }),
      map(({ events, phases }): Receipt => {
        const drawStarted = performance.now()
        app.renderer.render(app.stage)
        return { drawMs: performance.now() - drawStarted, events, phases }
      }),
      toArray(),
    ))

    const finishedAt = performance.now()
    const elapsedSeconds = (finishedAt - startedAt) / 1000
    const drawTimes = receipts.map((receipt) => receipt.drawMs)
    const totalDrawMs = drawTimes.reduce((sum, value) => sum + value, 0)
    const stats = {
      elapsedSeconds,
      requestedChanges,
      requestedChangeRateHz: requestedChanges / elapsedSeconds,
      actualRenders: receipts.length,
      actualRenderRateHz: receipts.length / elapsedSeconds,
      coalescedChanges: requestedChanges - receipts.length,
      coalescingRatio: 1 - receipts.length / requestedChanges,
      appendedEvents,
      eventRatePerSecond: appendedEvents / elapsedSeconds,
      appendedPhases,
      phaseRatePerSecond: appendedPhases / elapsedSeconds,
      retainedBatches,
      averageEventsPerRender: appendedEvents / receipts.length,
      averagePhasesPerRender: appendedPhases / receipts.length,
      averageDrawMs: totalDrawMs / receipts.length,
      p50DrawMs: percentile(drawTimes, 0.5),
      p95DrawMs: percentile(drawTimes, 0.95),
      maxDrawMs: Math.max(...drawTimes),
      totalDrawMs,
      drawDutyCycle: totalDrawMs / (elapsedSeconds * 1000),
    }

    console.log("MARBLER_PIXI_10S", JSON.stringify(stats))
    expect({
      elapsedAtLeastTenSeconds: stats.elapsedSeconds >= 10,
      rendered: stats.actualRenders > 0,
      retainedEvents: stats.appendedEvents > 0,
      coalesced: stats.coalescedChanges > 0,
    }).toMatchInlineSnapshot(`
      {
        "coalesced": true,
        "elapsedAtLeastTenSeconds": true,
        "rendered": true,
        "retainedEvents": true,
      }
    `)

    app.destroy(true, { children: true })
    host.remove()
  })
})
