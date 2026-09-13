import { describe, expect, it } from "vitest"
import { ident } from "./1_ident.js"
import { workerName } from "./6_spawn.js"

describe("parent handoff to a worker", () => {
  it("reads the parent key off the name its host gave it", async () => {
    const me = ident({ service: "host" })
    const url = new URL("./6_spawn.worker.ts", import.meta.url)
    const worker = new Worker(url, { name: workerName(me, "w"), type: "module" })
    const got = await new Promise<Record<string, unknown>>((resolve) => {
      worker.onmessage = (event: MessageEvent) => resolve(event.data as Record<string, unknown>)
    })
    worker.terminate()
    expect(got["parent"]).toBe(me.pid)
    expect(got["parentBorn"]).toBe(Math.round(me.born))
    expect(got["service"]).toBe("w")
  })
})
