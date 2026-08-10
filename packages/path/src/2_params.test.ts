import { describe, it, expect } from "vitest"
import { slash } from "./1_path.js"
import type { Param } from "./0_types.js"

const jsonParam = <T>(): Param<T> => ({
  parse: (raw) => (raw ? (JSON.parse(raw) as T) : undefined),
  print: (value) => JSON.stringify(value),
})

describe("Param composition", () => {
  it("mounts one Param on a query key and round-trips a typed value", () => {
    const route = slash("/users?{grid}", { params: { grid: jsonParam<{ page: number }>() } })
    const href = route.print({ grid: { page: 2 } })
    expect(href).toBe("/users?grid=%7B%22page%22%3A2%7D")
    const matched = route.match(href)
    expect(matched).toEqual({ matched: true, values: { grid: { page: 2 } } })
  })

  it("composes two Params under different keys -> typed compound Values", () => {
    type A = { sort: string }
    type B = { page: number }
    const route = slash("/dash?{a}&{b}", { params: { a: jsonParam<A>(), b: jsonParam<B>() } })
    const href = route.print({ a: { sort: "name" }, b: { page: 5 } })
    const matched = route.match(href)
    expect(matched.matched).toBe(true)
    if (matched.matched) {
      expect(matched.values).toEqual({ a: { sort: "name" }, b: { page: 5 } })
    }
  })

  it("names without a Param pass through as string", () => {
    const route = slash("/items?{q}", { params: {} })
    const href = route.print({ q: "shoes" })
    expect(href).toBe("/items?q=shoes")
    const matched = route.match(href)
    expect(matched).toEqual({ matched: true, values: { q: "shoes" } })
  })

  it("mounts a Param on a pathname slot", () => {
    const route = slash("/item/{id}", {
      params: { id: { parse: (r) => Number(r), print: (v: number) => String(v) } },
    })
    const matched = route.match("/item/42")
    expect(matched).toEqual({ matched: true, values: { id: 42 } })
  })

  it("parse returning undefined fails the match with reason values", () => {
    const route = slash("/u?{g}", { params: { g: jsonParam<{ x: number }>() } })
    const matched = route.match("/u?g=")
    expect(matched).toEqual({ matched: false, reason: "values" })
  })
})
