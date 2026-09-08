import { expect, it } from "vitest"
import { lancet, ogive, spire } from "./2a_architecture.js"

it("draws pointed crowns, jambs and paired crockets in the supplied coordinates", () => {
  expect({ arch: ogive(10, 20, 30, 40), window: lancet(0, 100, 40, 80), spire: spire(0, 100, 20, 80, 1) }).toMatchSnapshot()
})
