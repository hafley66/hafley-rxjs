import { act, useState } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it } from "vitest"
import { cdp, page } from "vitest/browser"
import { createTimeViewport, reduceTimeViewport, type TimelineGesture, type TimelineMark, type TimeViewport } from "./0a_TimeViewport"
import { TimeNavigatorPixi } from "./1b_TimeNavigatorPixi"
import "./2_marbler.css"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function NavigatorFixture({ marks, initial, git = false }: { marks: TimelineMark[]; initial: TimeViewport; git?: boolean }) {
  const [viewport, setViewport] = useState(initial)
  const gesture = (event: TimelineGesture) => setViewport((state) => reduceTimeViewport(state, event))
  return <section className={git ? "navigator-receipt git-receipt" : "navigator-receipt"} data-testid={git ? "git-timeline" : "stress-timeline"}>
    {git && <div className="git-lanes"><span>main</span><span>feature/grid</span><span>perf/pixi</span></div>}
    <TimeNavigatorPixi marks={marks} viewport={viewport} onGesture={gesture} />
    <output>{viewport.visible[0].toFixed(0)}–{viewport.visible[1].toFixed(0)} ms</output>
  </section>
}

function gitMarks(): TimelineMark[] {
  const commits = [
    ["a", 80, 0], ["b", 190, 0], ["c", 285, 1], ["d", 390, 1], ["e", 510, 0],
    ["f", 610, 2], ["g", 720, 2], ["h", 840, 0], ["i", 940, 0],
  ] as const
  const marks: TimelineMark[] = commits.map(([id, time, lane]) => ({ id, kind: "dot", time, lane }))
  const edges = [[80, 0, 190, 0], [190, 0, 285, 1], [285, 1, 390, 1], [390, 1, 510, 0], [510, 0, 610, 2], [610, 2, 720, 2], [720, 2, 840, 0], [840, 0, 940, 0]] as const
  edges.forEach(([fromTime, fromLane, toTime, toLane], index) => marks.unshift({ id: `edge-${index}`, kind: "link", from: { time: fromTime, lane: fromLane }, to: { time: toTime, lane: toLane } }))
  marks.push({ id: "build", kind: "span", start: 395, end: 480, lane: 1 })
  return marks
}

function rapidMarks(count: number): TimelineMark[] {
  return Array.from({ length: count }, (_, index): TimelineMark => index % 9 === 0
    ? { id: `event-${index}`, kind: "span", start: index * 3, end: index * 3 + 2 + index % 17, lane: index % 5 }
    : { id: `event-${index}`, kind: "dot", time: index * 3, lane: index % 5 })
}

async function animationFrames(count: number) {
  const durations: number[] = []
  let previous = performance.now()
  for (let index = 0; index < count; index++) {
    await new Promise<void>((resolve) => requestAnimationFrame((now) => {
      durations.push(now - previous)
      previous = now
      resolve()
    }))
  }
  return durations
}

async function jsHeapUsedBytes() {
  const session = cdp() as unknown as { send(method: string): Promise<unknown> }
  await session.send("Performance.enable")
  await session.send("HeapProfiler.collectGarbage")
  const result = await session.send("Performance.getMetrics") as { metrics: Array<{ name: string; value: number }> }
  return result.metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0
}

describe("time navigator receipts", () => {
  it("renders restrained git branch and merge marks", async () => {
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<NavigatorFixture marks={gitMarks()} initial={createTimeViewport([0, 1000])} git />))
    await expect.poll(() => host.querySelectorAll("canvas").length).toBe(1)
    await expect(page.getByTestId("git-timeline")).toMatchScreenshot("2_git-merge-timeline")
    await act(async () => root.unmount())
    host.remove()
  })

  it("profiles 100k rapid events through chaotic pan and zoom", { timeout: 20_000 }, async () => {
    const marks = rapidMarks(100_000)
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    const heapBefore = await jsHeapUsedBytes()
    const setupStarted = performance.now()
    await act(async () => root.render(<NavigatorFixture marks={marks} initial={createTimeViewport([0, 300_000])} />))
    await expect.poll(() => host.querySelectorAll("canvas").length).toBe(1)
    const setupMs = performance.now() - setupStarted
    const navigator = host.querySelector(".time-navigator") as HTMLDivElement
    const interactionStarted = performance.now()
    await act(async () => {
      Array.from({ length: 300 }, (_, index) => index).forEach((index) => {
        navigator.dispatchEvent(new WheelEvent("wheel", {
          deltaX: index % 3 === 0 ? (index % 2 ? 12 : -12) : 0,
          deltaY: index % 3 === 0 ? 0 : (index % 2 ? 9 : -9),
          clientX: 40 + index % 700,
          cancelable: true,
        }))
      })
    })
    const interactionMs = performance.now() - interactionStarted
    const frames = (await animationFrames(90)).slice(5)
    const sorted = [...frames].sort((a, b) => a - b)
    const frameP95Ms = sorted[Math.floor(sorted.length * 0.95)] ?? 0
    const heapAfter = await jsHeapUsedBytes()
    const receipt = {
      marks: marks.length,
      setupMs: Number(setupMs.toFixed(1)),
      interactionMs: Number(interactionMs.toFixed(1)),
      frameP95Ms: Number(frameP95Ms.toFixed(1)),
      approximateFps: Number((1000 / frameP95Ms).toFixed(1)),
      heapDeltaMb: Number(((heapAfter - heapBefore) / 1024 / 1024).toFixed(1)),
      heapUsedMb: Number((heapAfter / 1024 / 1024).toFixed(1)),
      canvasCount: host.querySelectorAll("canvas").length,
      pixiDomNodes: host.querySelectorAll(".time-navigator *").length,
    }
    console.log("MARBLER_CHAOS_100K", JSON.stringify(receipt))
    expect({
      setupUnderThreeSeconds: setupMs < 3000,
      interactionsUnderThreeSeconds: interactionMs < 3000,
      p95UnderTwoFrames: frameP95Ms < 34,
      heapDeltaUnder128Mb: heapAfter - heapBefore < 128 * 1024 * 1024,
      canvasCount: receipt.canvasCount,
      pixiDomNodes: receipt.pixiDomNodes,
    }).toMatchInlineSnapshot(`
      {
        "canvasCount": 1,
        "heapDeltaUnder128Mb": true,
        "interactionsUnderThreeSeconds": true,
        "p95UnderTwoFrames": true,
        "pixiDomNodes": 1,
        "setupUnderThreeSeconds": true,
      }
    `)
    await expect(page.getByTestId("stress-timeline")).toMatchScreenshot("3_100k-events-after-chaos")
    await act(async () => root.unmount())
    host.remove()
  })
})
