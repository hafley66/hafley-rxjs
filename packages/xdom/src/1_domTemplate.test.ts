// @vitest-environment jsdom
import { describe, expect, expectTypeOf, it, vi } from "vitest"
import { Dom } from "./1_domTemplate.js"

describe("Dom template", () => {
  it("makes ordinary ids for repeated JSX rows", () => {
    const remove = Dom("/users/:id/remove")
    expect(remove.id({ id: 42 })).toBe("/users/42/remove")
    expect(remove.with({ id: "a b" }).id).toBe("/users/a%20b/remove")
    // Missing a required param throws (path print contract, stricter than silent-fill).
    expect(() => remove.id({} as never)).toThrow("Missing path value: id")
  })

  it("delegates one stream across repeated elements and extracts typed params", () => {
    const remove = Dom("/users/:id/remove")
    document.body.innerHTML = `
      <button id="${remove.id({ id: 1 })}"><span>one</span></button>
      <button id="${remove.id({ id: 2 })}">two</button>
    `
    const next = vi.fn()
    const subscription = remove.$.click.subscribe(event => {
      expectTypeOf(event.params.id).toEqualTypeOf<string>()
      next(event.params.id, event.delegateElement.id)
    })
    document.querySelector("span")!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    document.getElementById(remove.id({ id: 2 }))!.click()
    expect(next.mock.calls).toEqual([
      ["1", "/users/1/remove"],
      ["2", "/users/2/remove"],
    ])
    subscription.unsubscribe()
  })

  it("does not confuse sibling templates", () => {
    const edit = Dom("/users/:id/edit")
    const remove = Dom("/users/:id/remove")
    const editNext = vi.fn()
    const removeNext = vi.fn()
    const subscriptions = [edit.$.click.subscribe(editNext), remove.$.click.subscribe(removeNext)]
    const button = document.createElement("button")
    button.id = remove.id({ id: 7 })
    document.body.append(button)
    button.click()
    expect(editNext).not.toHaveBeenCalled()
    expect(removeNext).toHaveBeenCalledOnce()
    subscriptions.forEach(subscription => subscription.unsubscribe())
  })

  it("relative routing composes data-route segments and inherits ancestor params", () => {
    const expand = Dom("/grid/:gridId/row/:rowId/:colId/expand")
    document.body.innerHTML = `
      <div data-route="grid" data-grid-id="main">
        <div data-route="row" data-row-id="42">
          <button data-route="expand" data-col-id="name"><span>+</span></button>
        </div>
      </div>
    `
    const next = vi.fn()
    const sub = expand.route.click.subscribe((event) => {
      expectTypeOf(event.params.gridId).toEqualTypeOf<string>()
      next({ ...event.params }, event.delegateElement.dataset.route)
    })
    document.querySelector("span")!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(next.mock.calls).toEqual([
      [{ gridId: "main", rowId: "42", colId: "name" }, "expand"],
    ])
    sub.unsubscribe()
  })

  it("relative routing lets the closest ancestor param win", () => {
    const expand = Dom("/grid/:gridId/row/:rowId/:colId/expand")
    document.body.innerHTML = `
      <div data-route="grid" data-grid-id="main">
        <div data-route="row" data-row-id="outer">
          <button data-route="expand" data-row-id="inner" data-col-id="name">+</button>
        </div>
      </div>
    `
    const next = vi.fn()
    const sub = expand.route.click.subscribe((event) => next(event.params.rowId))
    document.querySelector("button")!.click()
    expect(next.mock.calls).toEqual([["inner"]])
    sub.unsubscribe()
  })

  it("boxAttrs stamps the route skeleton and kebab-cased params", () => {
    const expand = Dom("/grid/:gridId/row/:rowId/:colId/expand")
    expect(expand.boxAttrs({ gridId: "main", rowId: 42, colId: "name" })).toEqual({
      "data-route": "grid/row/expand",
      "data-grid-id": "main",
      "data-row-id": "42",
      "data-col-id": "name",
    })
  })
})
