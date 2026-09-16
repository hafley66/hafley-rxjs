// biome-ignore-all lint/correctness/noUnusedVariables: the assertions are this file's only output; `tsc` reads them.
import type { Locator as PlaywrightLocator, Page as PlaywrightPage } from "playwright"
import type { ExtensionLocator, ExtensionPage } from "./1_Page.js"

/**
 * Compile-time conformance with Playwright's published types. Nothing here runs: `tsc` is the assertion.
 *
 * `page` and `locator` promise a Playwright-typed call site that its arguments are accepted and its
 * result shape is usable. A member that fails would be a lie in the surface, so every exclusion is
 * listed with its reason and pinned by `@ts-expect-error`, which stops compiling if the gap closes.
 */

/**
 * `true` only when every call Playwright's member allows is a call our member accepts, and the result
 * is usable where Playwright's result would be.
 */
type AcceptsTheirCalls<Their, Ours> = Their extends (...args: infer TheirArgs) => infer TheirResult
  ? Ours extends (...args: infer OurArgs) => infer OurResult
    ? TheirArgs extends OurArgs
      ? TheirArgs["length"] extends OurArgs["length"]
        ? OurResult extends TheirResult
          ? true
          : false
        : false
      : false
    : never
  : never

declare const page: ExtensionPage
declare const locator: ExtensionLocator

// Page: the members Playwright's caller can call unchanged.
const url: PlaywrightPage["url"] = page.url
const isClosed: PlaywrightPage["isClosed"] = page.isClosed
const bringToFront: PlaywrightPage["bringToFront"] = page.bringToFront

// `goto` returns the navigation response Playwright's caller may read, and Playwright's optional
// `waitUntil`/`timeout` is dropped; here navigation returns as soon as the tab is asked to move.
// @ts-expect-error declared narrow: a URL only, and no response
const goto: AcceptsTheirCalls<PlaywrightPage["goto"], typeof page.goto> = true
// Locator factories return Playwright's own `Locator`, whose other 30 members are not implemented.
// @ts-expect-error declared narrow: locators are `LocatorControls`, not Playwright's `Locator`
const getByRole: AcceptsTheirCalls<PlaywrightPage["getByRole"], typeof page.getByRole> = true
// @ts-expect-error declared narrow: `fullPage`/`clip` rasterize in the page realm and return `{ mime, base64 }`
const screenshot: AcceptsTheirCalls<PlaywrightPage["screenshot"], typeof page.screenshot> = true
// @ts-expect-error declared narrow: `evaluate` takes a function-source string plus positional args
const evaluate: AcceptsTheirCalls<PlaywrightPage["evaluate"], typeof page.evaluate> = true
// `waitForURL` accepts a string or predicate in Playwright and only a RegExp here; options are required.
// @ts-expect-error declared narrow: RegExp patterns only
const waitForURL: AcceptsTheirCalls<PlaywrightPage["waitForURL"], typeof page.waitForURL> = true

// Locator: the action and read surface, which runs through the injected selector engine.
const click: AcceptsTheirCalls<PlaywrightLocator["click"], typeof locator.click> = true
const fill: AcceptsTheirCalls<PlaywrightLocator["fill"], typeof locator.fill> = true
const hover: AcceptsTheirCalls<PlaywrightLocator["hover"], typeof locator.hover> = true
const press: AcceptsTheirCalls<PlaywrightLocator["press"], typeof locator.press> = true
const waitFor: AcceptsTheirCalls<PlaywrightLocator["waitFor"], typeof locator.waitFor> = true
const count: AcceptsTheirCalls<PlaywrightLocator["count"], typeof locator.count> = true
const isVisible: AcceptsTheirCalls<PlaywrightLocator["isVisible"], typeof locator.isVisible> = true
const isEnabled: AcceptsTheirCalls<PlaywrightLocator["isEnabled"], typeof locator.isEnabled> = true
const isChecked: AcceptsTheirCalls<PlaywrightLocator["isChecked"], typeof locator.isChecked> = true
const inputValue: AcceptsTheirCalls<PlaywrightLocator["inputValue"], typeof locator.inputValue> = true
const textContent: AcceptsTheirCalls<PlaywrightLocator["textContent"], typeof locator.textContent> = true
const getAttributeCall: AcceptsTheirCalls<PlaywrightLocator["getAttribute"], typeof locator.getAttribute> = true
const allTextContents: AcceptsTheirCalls<PlaywrightLocator["allTextContents"], typeof locator.allTextContents> = true

// Selection is by option label only; Playwright also accepts an option value, an index, and arrays.
// @ts-expect-error declared narrow: `{ label }` selection only
const selectOption: AcceptsTheirCalls<PlaywrightLocator["selectOption"], typeof locator.selectOption> = true
// Chaining returns Playwright's own `Locator`.
// @ts-expect-error declared narrow: locators are `LocatorControls`, not Playwright's `Locator`
const nth: AcceptsTheirCalls<PlaywrightLocator["nth"], typeof locator.nth> = true
// @ts-expect-error declared narrow: `has` takes a `LocatorControls`, not Playwright's `Locator`
const filter: AcceptsTheirCalls<PlaywrightLocator["filter"], typeof locator.filter> = true

// The helper itself is not vacuous: a member checked against the wrong Playwright counterpart fails.
// @ts-expect-error `count` returns a number where `click` returns nothing
const mismatched: AcceptsTheirCalls<PlaywrightLocator["click"], typeof locator.count> = true

export type { AcceptsTheirCalls }
