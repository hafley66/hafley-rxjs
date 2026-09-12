import { describe, expect, it } from "vitest"
import { Route } from "./5_Route.js"

describe("Route", () => {
  it("flattens path and query values", () => {
    history.replaceState(null, "", "/repos/hafley/instant?panel=worktrees")
    const route = Route("/repos/:owner/:repo")
    expect(route.$()).toMatchObject({ owner: "hafley", repo: "instant", panel: "worktrees", matched: true })
    expect(route.href({ owner: "hafley", repo: "instant", panel: "activity" })).toBe("/repos/hafley/instant?panel=activity")
  })

  it("updates after declarative navigation", () => {
    const route = Route("/users/:id")
    const sub = route.$.subscribe()
    route.navigate({ id: 42, tab: "history" })
    expect(route.$()).toMatchObject({ id: "42", tab: "history", matched: true })
    sub.unsubscribe()
  })
})

describe("Route base", () => {
  it("matches under a base and prints it back", () => {
    history.replaceState(null, "", "/hafley-rxjs/app/demo/tree")
    const route = Route("/:demo", { base: "/hafley-rxjs/app/demo" })
    expect(route.base).toBe("/hafley-rxjs/app/demo")
    expect(route.$()).toMatchObject({ demo: "tree", matched: true })
    expect(route.href({ demo: "sheet" })).toBe("/hafley-rxjs/app/demo/sheet")
  })

  it("misses outside the base instead of slicing a wrong remainder", () => {
    history.replaceState(null, "", "/elsewhere/tree")
    const route = Route("/:demo", { base: "/hafley-rxjs/app/demo" })
    expect(route.$().matched).toBe(false)
    expect(route.$().demo).toBeUndefined()
  })

  it("treats a trailing slash and a missing leading slash as the same base", () => {
    history.replaceState(null, "", "/app/tree")
    expect(Route("/:demo", { base: "app/" }).$()).toMatchObject({ demo: "tree", matched: true })
  })

  it("binds a brace param the same as a colon param", () => {
    history.replaceState(null, "", "/g/17")
    const brace = Route("/g/{gridId}")
    const colon = Route("/g/:gridId")
    expect(brace.$().gridId).toBe("17")
    expect(colon.$().gridId).toBe("17")
    expect(brace.href({ gridId: "18" })).toBe("/g/18")
  })

  it("chains a child route that keeps the base and joins the params", () => {
    history.replaceState(null, "", "/app/g/7/r/9")
    const grid = Route("/g/:gridId", { base: "/app" })
    const row = grid.child("/r/:rowId")
    expect(row.template).toBe("/g/:gridId/r/:rowId")
    expect(row.base).toBe("/app")
    expect(row.$()).toMatchObject({ gridId: "7", rowId: "9", matched: true })
    expect(row.href({ gridId: "1", rowId: "2" })).toBe("/app/g/1/r/2")
  })
})
