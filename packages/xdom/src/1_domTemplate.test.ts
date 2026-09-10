// @vitest-environment jsdom
import { describe, expect, expectTypeOf, it, vi } from "vitest"
import { Dom, ROUTE_BOUNDARY_ATTR } from "./1_domTemplate.js"

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

// A component that can contain itself has no other way to route: the ancestor walk reaches the
// document, so an inner instance would compose the outer chain and its own and match neither.
describe("a route boundary ends the ancestor walk", () => {
  const nested = Dom("/g/:gridId/r/:rowId/c/:colId")

  const mount = (mark: string): void => {
    document.body.innerHTML = `
      <div data-route="g" data-grid-id="outer"${mark}>
        <div data-route="r" data-row-id="1">
          <div data-route="c" data-col-id="name" id="outer-cell">
            <div data-route="g" data-grid-id="inner"${mark}>
              <div data-route="r" data-row-id="9">
                <div data-route="c" data-col-id="qty" id="inner-cell"><span id="glyph">+</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  const clickAndCollect = (selector: string): Record<string, string>[] => {
    const seen: Record<string, string>[] = []
    const subscription = nested.route.click.subscribe(event => seen.push({ ...event.params }))
    document.querySelector<HTMLElement>(selector)?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    subscription.unsubscribe()
    return seen
  }

  it("gives the inner instance its own chain", () => {
    mount(` ${ROUTE_BOUNDARY_ATTR}=""`)
    expect(clickAndCollect("#glyph")).toEqual([{ gridId: "inner", rowId: "9", colId: "qty" }])
  })

  it("leaves the outer instance reading the same as it always did", () => {
    mount(` ${ROUTE_BOUNDARY_ATTR}=""`)
    expect(clickAndCollect("#outer-cell")).toEqual([{ gridId: "outer", rowId: "1", colId: "name" }])
  })

  it("matches nothing without one, which is the defect it exists for", () => {
    mount("")
    expect(clickAndCollect("#glyph")).toEqual([])
  })

  it("collects params below it and none above it", () => {
    document.body.innerHTML = `
      <div data-route="g" data-grid-id="outer">
        <div data-route="r" data-row-id="1">
          <div data-route="c" data-col-id="name">
            <div data-route="g" ${ROUTE_BOUNDARY_ATTR}="">
              <div data-route="r" data-row-id="9">
                <div data-route="c" data-col-id="qty" id="inner-cell">x</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
    expect(clickAndCollect("#inner-cell")).toEqual([])
  })
})
