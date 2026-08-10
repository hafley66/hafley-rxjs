import { strict as assert } from "node:assert"
import { describe, it } from "node:test"
import * as z from "zod"
import { route, NumberPathParam, BooleanPathParam, StringPathParam } from "../dist/index.js"

describe("route — typed path params", () => {
  const Changed = route(
    `panel/${NumberPathParam("id")}/changed`,
    z.object({ revision: z.coerce.number(), view: z.enum(["graph", "table"]).optional() }),
    z.object({ changed: z.boolean(), rows: z.array(z.string()) }),
  )

  it("href prints path and query, omits payload keys", () => {
    assert.equal(
      Changed.href({ id: 42, revision: 7, changed: true, rows: ["a", "b"] }),
      "panel/42/changed?revision=7",
    )
  })

  it("href omits optional query that is absent", () => {
    assert.equal(
      Changed.href({ id: 1, revision: 2, view: "graph", changed: false, rows: [] }),
      "panel/1/changed?revision=2&view=graph",
    )
  })

  it("match coerces number path params and query, excludes payload", () => {
    assert.deepEqual(
      Changed.match("panel/42/changed?revision=7"),
      { matched: true, values: { id: 42, revision: 7 } },
    )
  })

  it("match fails on a wrong literal segment", () => {
    assert.deepEqual(
      Changed.match("panel/42/created?revision=7"),
      { matched: false, reason: "structure" },
    )
  })

  it("match fails on a non-numeric number param", () => {
    const result = Changed.match("panel/forty-two/changed?revision=7")
    assert.equal(result.matched, false)
    assert.equal(result.reason, "values")
  })

  it("match round-trips href output back to typed url values", () => {
    const href = Changed.href({ id: 99, revision: 3, view: "table", changed: true, rows: [] })
    assert.deepEqual(Changed.match(href), { matched: true, values: { id: 99, revision: 3, view: "table" } })
  })

  it("href throws on a value that fails the payload schema", () => {
    assert.throws(() =>
      Changed.href({ id: 1, revision: 1, changed: "not-a-boolean", rows: [] }),
    )
  })
})

describe("route — boolean and string params", () => {
  const Flagged = route(
    `/flag/${BooleanPathParam("on")}/${StringPathParam("label")}`,
    z.object({}),
    z.object({}),
  )

  it("round-trips boolean true and a string label", () => {
    const href = Flagged.href({ on: true, label: "go" })
    assert.equal(href, "/flag/true/go")
    assert.deepEqual(Flagged.match(href), { matched: true, values: { on: true, label: "go" } })
  })

  it("round-trips boolean false distinctly from true", () => {
    const href = Flagged.href({ on: false, label: "stop" })
    assert.equal(href, "/flag/false/stop")
    assert.deepEqual(Flagged.match(href), { matched: true, values: { on: false, label: "stop" } })
  })
})

describe("route — full usage", () => {
  const Mixed = route(
    `/org/${NumberPathParam("orgId")}/repo/${StringPathParam("name")}`,
    z.object({ page: z.coerce.number() }),
    z.object({ starred: z.boolean() }),
  )

  it("round-trips a multi-segment route with three scalar kinds through href and match", () => {
    const value = { orgId: 7, name: "rx", page: 2, starred: true }
    const href = Mixed.href(value)
    assert.equal(href, "/org/7/repo/rx?page=2")
    assert.deepEqual(Mixed.match(href), { matched: true, values: { orgId: 7, name: "rx", page: 2 } })
  })

  it("match leaves payload out of the url values even when present in the input", () => {
    const matched = Mixed.match("/org/1/repo/x?page=9")
    assert.deepEqual(matched, { matched: true, values: { orgId: 1, name: "x", page: 9 } })
  })

  it("match reports values failure when a required query param is missing", () => {
    const result = Mixed.match("/org/1/repo/x")
    assert.equal(result.matched, false)
    assert.equal(result.reason, "values")
  })

  it("repeated round-trips stay stable across a sequence of values", () => {
    for (const orgId of [0, 1, 42, 1000]) {
      const href = Mixed.href({ orgId, name: "n", page: 1, starred: false })
      const back = Mixed.match(href)
      assert.equal(back.matched, true)
      assert.equal(back.values.orgId, orgId)
    }
  })

  it("a literal-only route with payload still prints and matches", () => {
    const Health = route("/health", z.object({}), z.object({ checks: z.array(z.string()) }))
    assert.equal(Health.href({ checks: ["db"] }), "/health")
    assert.deepEqual(Health.match("/health"), { matched: true, values: {} })
  })
})
