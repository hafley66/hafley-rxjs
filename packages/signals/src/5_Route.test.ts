// @vitest-environment jsdom
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
