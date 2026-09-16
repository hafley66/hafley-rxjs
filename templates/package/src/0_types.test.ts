import { expectTypeOf, it } from "vitest"
import { defaults } from "./0_types.js"

it("defaults resolve every option", () => {
  expectTypeOf(defaults.trace).toEqualTypeOf<boolean>()
})
