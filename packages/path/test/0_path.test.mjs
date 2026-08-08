import assert from "node:assert/strict"
import test from "node:test"
import {
  fileLocator,
  path,
  slash,
  toOpenApiPattern,
  toReactRouterPattern,
  toTanStackPattern,
} from "../dist/index.js"

test("prints and matches positional, query, and pointer values", () => {
  const value = slash("/users/{userIdentifier}?{tab?}#{row}")
  assert.equal(value.print({ userIdentifier: "a b", tab: "details", row: "r 1" }), "/users/a%20b?tab=details#r%201")
  assert.deepEqual(value.match("/users/a%20b?tab=details#r%201"), {
    matched: true,
    values: { userIdentifier: "a b", tab: "details", row: "r 1" },
  })
})

test("validates allowed values and whole-object conversion", () => {
  const localized = path(slash, "/{locale}", { values: { locale: ["en", "fr"] } })
  assert.deepEqual(localized.match("/de"), { matched: false, reason: "values" })
  const numeric = path(slash, "/{id}", {
    parse(values) { return /^\d+$/.test(values.id) ? { id: Number(values.id) } : undefined },
    print(values) { return { id: String(values.id) } },
  })
  assert.deepEqual(numeric.match("/42"), { matched: true, values: { id: 42 } })
  assert.deepEqual(numeric.match("/x"), { matched: false, reason: "values" })
  const throws = path(slash, "/{id}", {
    parse() { throw new Error("invalid id") },
    print(values) { return { id: String(values.id) } },
  })
  const failedMatch = throws.match("/x")
  assert.equal(failedMatch.matched, false)
  assert.equal(failedMatch.reason, "values")
  assert.equal(failedMatch.error instanceof Error, true)
})

test("composes independently configured public paths", () => {
  const organization = path(slash, "/organizations/{organizationIdentifier}", {
    values: { organizationIdentifier: ["acme", "openai"] },
  })
  const user = path(slash, "/users/{userIdentifier}?{page?}", {
    parse(values) {
      return { userIdentifier: Number(values.userIdentifier), page: Number(values.page ?? 1) }
    },
    print(values) {
      return { userIdentifier: String(values.userIdentifier), page: String(values.page) }
    },
  })
  const value = organization.concatenate(user)
  assert.equal(value.print({ organizationIdentifier: "acme", userIdentifier: 42, page: 2 }), "/organizations/acme/users/42?page=2")
  assert.deepEqual(value.match("/organizations/acme/users/42?page=2"), {
    matched: true,
    values: { organizationIdentifier: "acme", userIdentifier: 42, page: 2 },
  })
  assert.deepEqual(value.match("/organizations/other/users/42?page=2"), { matched: false, reason: "values" })
})

test("renders route grammar adapters and file locator pointers", () => {
  const optional = path(slash, "/users/{id}/{section?}")
  assert.equal(toReactRouterPattern(optional), "/users/:id/:section?")
  assert.equal(toTanStackPattern(optional), "/users/$id/{-$section}")
  assert.equal(toOpenApiPattern(path(slash, "/users/:id")), "/users/{id}")
  assert.equal(path(fileLocator, "source/file.ts:{line}").print({ line: "120" }), "source/file.ts:120")
})

test("constructs paths from callable syntax values", () => {
  const users = slash("/users")
  const user = users.concatenate(slash("/{userIdentifier}"))
  assert.equal(user.print({ userIdentifier: "42" }), "/users/42")
  assert.equal(fileLocator("source/file.ts:{line}").print({ line: "120" }), "source/file.ts:120")
})
