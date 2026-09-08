// The published surface: everything a consumer reaches through "@hafley66/vitest-playwright" and its subpaths.
import { describe, expect as vitestExpect, it } from "vitest"
import * as barrel from "../src/index.js"
import { expect, test } from "../src/index.js"
import { boot, URL } from "./0_bootstrap.js"

describe("barrel", () => {
  it("exports exactly the public surface", () => {
    vitestExpect(Object.keys(barrel).sort()).toEqual(["baselinePath", "describe", "expect", "it", "playwrightMatchers", "serializeExpectedText", "test", "vitestPlaywright"])
    vitestExpect(Object.keys(barrel.playwrightMatchers).length).toBe(30)
  })
  test("test and expect from the barrel drive a page", async ({ page }) => {
    await boot(page)
    await expect(page.locator("#vis")).toBeVisible()
    await expect(page).toHaveURL(URL)
  })
  it("the plugin returns the tel:plugin shape", () => {
    const cfg = barrel.vitestPlaywright({ expect: { timeout: 1 } }).config({})
    vitestExpect(Object.keys(cfg.test ?? {}).sort()).toEqual(["globalSetup", "isolate", "provide", "runner", "setupFiles"])
  })
})
