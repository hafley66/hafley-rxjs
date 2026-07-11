// @vitest-environment jsdom
import { describe, expect, expectTypeOf, it, vi } from "vitest"
import { Dom } from "./8_domTemplate.js"

describe("Dom template", () => {
  it("makes ordinary ids for repeated JSX rows", () => {
    const remove = Dom("/users/:id/remove")
    expect(remove.id({ id: 42 })).toBe("/users/42/remove")
    expect(remove.with({ id: "a b" }).id).toBe("/users/a%20b/remove")
    // @ts-expect-error id is required by the template
    remove.id({})
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
})
