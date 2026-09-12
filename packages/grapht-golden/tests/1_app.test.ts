import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { BehaviorSubject, Observable, type OperatorFunction } from "rxjs"
import { describe, expect, test } from "vitest"
import { renderRendererSelection } from "../src/1_app.js"

const testsDirectory = fileURLToPath(new URL(".", import.meta.url))

describe("golden app composition", () => {
  test("imports and composes production operators and renderer adapters", async () => {
    const source = await readFile(resolve(testsDirectory, "../src/1_app.ts"), "utf8")

    expect(source).toMatch(/fcoseGraphLayout/)
    expect(source).toMatch(/layout\(fcoseGraphLayout\)/)
    expect(source).toMatch(/present\(\{/)
    expect(source).toMatch(/cytoscapeGraphRenderer\(interactions\)/)
    expect(source).toMatch(/pixiGraphRenderer\(\{ interactions \}\)/)
    expect(source).toMatch(/switchMap\(rendererId/)
  })

  test("switching renderers unsubscribes the previous public renderer subscription", () => {
    const rendererId$ = new BehaviorSubject<"first" | "second">("first")
    const frame$ = new Observable<unknown>()
    let firstUnsubscribes = 0
    let secondUnsubscribes = 0
    const renderer = (onUnsubscribe: () => void): ((host: HTMLElement) => OperatorFunction<unknown, unknown>) =>
      () =>
        () =>
          new Observable<unknown>(() => onUnsubscribe)
    const subscription = renderRendererSelection({} as HTMLElement, frame$, rendererId$, {
      first: renderer(() => { firstUnsubscribes += 1 }),
      second: renderer(() => { secondUnsubscribes += 1 }),
    })

    rendererId$.next("second")
    expect(firstUnsubscribes).toBe(1)
    subscription.unsubscribe()
    expect(secondUnsubscribes).toBe(1)
  })

  test("app source has no graph frame or sticky implementation boundary leaks", async () => {
    const source = await readFile(resolve(testsDirectory, "../src/1_app.ts"), "utf8")

    expect(source).not.toMatch(/GraphFrame|GraphPresentation|HeaderPlacement|stackGroupHeaders/)
  })

  test("Vite resolves only production package public barrels", async () => {
    const config = await readFile(resolve(testsDirectory, "../vite.config.ts"), "utf8")

    expect(config).not.toMatch(/0a_production/)
    expect(config).toMatch(/packages\/grapht\/src\/27_browser\.ts/)
    expect(config).toMatch(/2_render_cytoscape\/index\.ts/)
    expect(config).toMatch(/6_render_pixijs\/src\/index\.ts/)
  })
})
