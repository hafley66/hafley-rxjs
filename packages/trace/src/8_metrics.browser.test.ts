import { expect, it } from "vitest"
import { firstValueFrom, take, toArray } from "rxjs"
import { metrics$, memorySample } from "./8_metrics.js"
import { lag$ } from "./4_lag.js"

it("samples a real host, retains one memory reading between scans, and reports actual frame-window duration", async () => {
  const host = document.createElement("div")
  host.innerHTML = "<span>text</span><div><b>nested</b></div>"
  document.body.append(host)
  try {
    const values = await firstValueFrom(metrics$(host).pipe(take(3), toArray()))
    expect(values.map(value => value.memory.domElements)).toMatchInlineSnapshot(`
      [
        3,
        3,
        3,
      ]
    `)
    expect(values.every(value => value.fps > 0 && value.worst > 0)).toBe(true)
    expect(values[0]!.memory).toBe(values[1]!.memory)
    host.append(document.createElement("i"))
    expect(memorySample(host).domElements).toBe(4)
    const sample = await firstValueFrom(lag$("raf", 100))
    expect(sample.elapsedMs).toBeGreaterThanOrEqual(100)
    expect(sample.fps).toBe(1000 * sample.samples / sample.elapsedMs)
  } finally { host.remove() }
})
