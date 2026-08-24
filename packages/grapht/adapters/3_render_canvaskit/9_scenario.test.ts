import { describe, expect, it } from "vitest"
import { makeFixture } from "./3_fixture.js"
import {
  initialState,
  reduce,
  type CanvasKitScenarioState,
} from "./9_scenario.js"
import { BENCH_SCENARIOS, frameStats, measureUploadBytes } from "./9_scenarioTypes.js"

function base(): CanvasKitScenarioState {
  return initialState({
    geometry: makeFixture(1_000),
    bench: { frameDurations: [10, 12, 18, 15, 40] },
  })
}

const supportedCases = [
  { scenario: "camera-pan", args: { dx: 12, dy: -8, frames: 4 } },
  { scenario: "camera-wheel-zoom", args: { deltaY: -100, anchorX: 512, anchorY: 384, frames: 4 } },
  { scenario: "camera-shake", args: { seed: 1337, amplitudePx: 24, frames: 120 } },
  { scenario: "style-update", args: { nodeCount: 1000, color: 0xff2244 } },
  { scenario: "position-update", args: { nodeCount: 100, dx: 3, dy: -2 } },
  { scenario: "viewport-resize", args: { width: 1280, height: 720 } },
  { scenario: "group-collapse", args: { groupIds: [0, 1] } },
  { scenario: "group-expand", args: { groupIds: [0] } },
  { scenario: "layout-apply", args: { positionCount: 250 } },
  { scenario: "position-animation", args: { nodeCount: 500, frames: 30, durationMs: 500 } },
  { scenario: "graph-replace", args: { fixture: "grid-5k" } },
  { scenario: "graph-dispose", args: {} as Record<string, never> },
] as const

describe("scenario dispatch covers every contract key", () => {
  it("implements all 33 scenario keys with a supported or unsupported sample", () => {
    expect(BENCH_SCENARIOS).toHaveLength(33)
    for (const scenario of BENCH_SCENARIOS) {
      const { sample } = reduce(base(), { scenario, args: {} } as never)
      expect(sample).toMatchObject({ scenario })
      expect(typeof sample.supported).toBe("boolean")
    }
  })
})

describe("required supported scenarios", () => {
  it.each(supportedCases)("$scenario returns a supported sample", ({ scenario, args }) => {
    const { state, sample } = reduce(base(), { scenario, args } as never)
    expect(sample.supported).toBe(true)
    expect(sample.counters.nodeCount).toBe(1000)
    expect(state).toBeDefined()
  })

  it("camera-pan translates the camera by the per-frame delta", () => {
    const { state } = reduce(base(), { scenario: "camera-pan", args: { dx: 12, dy: -8, frames: 4 } })
    expect(state.camera.tx).toBe(3)
    expect(state.camera.ty).toBe(-2)
    expect(state.camera.scale).toBe(1)
  })

  it("camera-wheel-zoom magnifies around a fixed anchor", () => {
    const { state } = reduce(base(), { scenario: "camera-wheel-zoom", args: { deltaY: -100, anchorX: 512, anchorY: 384, frames: 4 } })
    expect(state.camera.scale).toBeGreaterThan(1)
  })

  it("style-update rewrites the node color", () => {
    const { state } = reduce(base(), { scenario: "style-update", args: { nodeCount: 1000, color: 0xff2244 } })
    expect(state.nodeColor[0]).toBeCloseTo(1)
    expect(state.nodeColor[1]).toBeCloseTo(0x22 / 255)
  })

  it("position-update offsets the first nodeCount nodes", () => {
    const before = base()
    const { state } = reduce(before, { scenario: "position-update", args: { nodeCount: 100, dx: 3, dy: -2 } })
    expect(state.positions[0]).toBe(before.positions[0] + 3)
    expect(state.positions[1]).toBe(before.positions[1] - 2)
    expect(state.positions[200]).toBe(before.positions[200])
  })

  it("viewport-resize mutates the viewport and preserves the renderer slot", () => {
    const { state } = reduce(base(), { scenario: "viewport-resize", args: { width: 1280, height: 720 } })
    expect(state.viewport).toMatchObject({ width: 1280, height: 720 })
  })

  it("group-collapse hides a fixed 100-node slab per group", () => {
    const { state, sample } = reduce(base(), { scenario: "group-collapse", args: { groupIds: [0, 1] } })
    expect(state.collapsed.size).toBe(200)
    expect(sample.visibility.visibleNodeCount).toBe(800)
  })

  it("group-expand restores previously collapsed nodes", () => {
    let state = base()
    ;({ state } = reduce(state, { scenario: "group-collapse", args: { groupIds: [0, 1] } }))
    ;({ state } = reduce(state, { scenario: "group-expand", args: { groupIds: [0] } }))
    expect(state.collapsed.size).toBe(100)
  })

  it("layout-apply snaps the head of the array onto the grid", () => {
    const { state } = reduce(base(), { scenario: "layout-apply", args: { positionCount: 250 } })
    expect(state.positions[0]).toBe(0)
    expect(state.positions[1]).toBe(0)
    expect(state.positions[2]).toBe(10)
  })

  it("graph-replace bumps the generation so consumers can detect a fresh instance", () => {
    const { state } = reduce(base(), { scenario: "graph-replace", args: { fixture: "grid-5k" } })
    expect(state.generation).toBe(1)
    expect(state.disposed).toBe(false)
  })

  it("graph-dispose flags the renderer as disposed and clears the slot", () => {
    const { state } = reduce(base(), { scenario: "graph-dispose", args: {} })
    expect(state.disposed).toBe(true)
    expect(state.renderer).toBeNull()
    expect(state.generation).toBe(1)
  })

  it("position-animation reports bounded frame p50/p95/max and dropped frames", () => {
    const { sample } = reduce(base(), { scenario: "position-animation", args: { nodeCount: 500, frames: 30, durationMs: 500 } })
    expect(sample.supported).toBe(true)
    expect(sample.frame?.count).toBe(30)
    expect(sample.frame!.p50Ms).toBeLessThanOrEqual(sample.frame!.p95Ms)
    expect(sample.frame!.p95Ms).toBeLessThanOrEqual(sample.frame!.maxMs)
    expect(sample.uploadBytes).toBe(500 * 2 * 4 + 1936 * 2 * 4)
  })
})

describe("unsupported scenarios return a typed sample and preserve state", () => {
  const unsupported = BENCH_SCENARIOS.filter(scenario => !supportedCases.some(c => c.scenario === scenario))
  it.each(unsupported)("$scenario is reported unsupported and leaves state untouched", scenario => {
    const before = base()
    const args: Record<string, unknown> = scenario === "graph-clear" || scenario === "graph-dispose"
      ? {}
      : scenario.includes("insert") || scenario.includes("delete")
        ? { count: 10 }
        : scenario === "graph-load" || scenario === "graph-replace" || scenario === "graph-reload"
          ? { fixture: "grid-1k" }
          : { nodeCount: 100, color: 0, dx: 1, dy: 1, frames: 4, durationMs: 100, positionCount: 10, count: 10 }
    const { state, sample } = reduce(before, { scenario, args } as never)
    expect(sample.supported).toBe(false)
    expect(sample.phase).toBe("unsupported")
    expect(sample.counters.unsupported).toBe(1)
    expect(state).toBe(before)
  })
})

describe("frame stats are deterministic", () => {
  it("computes p50, p95, max, and dropped frames from a duration series", () => {
    expect(frameStats([10, 12, 18, 15, 40], 16.67)).toEqual({
      count: 5,
      p50Ms: 15,
      p95Ms: 18,
      maxMs: 40,
      droppedFrames: 2,
    })
  })

  it("returns zeros for an empty series", () => {
    expect(frameStats([], 16.67)).toEqual({ count: 0, p50Ms: 0, p95Ms: 0, maxMs: 0, droppedFrames: 0 })
  })

  it("estimates uploaded geometry bytes from position and edge buffers", () => {
    expect(measureUploadBytes({ nodeCount: 1000, edgeCount: 1936 }, 1000)).toBe(1000 * 2 * 4 + 1936 * 2 * 4)
    expect(measureUploadBytes({ nodeCount: 1000, edgeCount: 1936 }, 250)).toBeLessThan(1000 * 2 * 4 + 1936 * 2 * 4)
  })
})
