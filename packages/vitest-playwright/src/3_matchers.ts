// pkg:matchers: 27 locator/page matchers + toBeOK + toPass over pw:Locator._expect / pw:Frame._expect, plus
// toHaveScreenshot (11_screenshot) and the toMatchSnapshot alias that routes a Page/Locator receiver to it.
// Polling is server-side inside playwright; each matcher is one await. Payloads follow PLAN §2.2.
import type { APIResponse, Frame, Locator, Page } from "playwright"
import { lastValueFrom } from "rxjs"
import { chai, inject, type Matcher, type MatcherState } from "vitest"
import { KEY } from "./0_options.js"
import { poll$ } from "./5_streams.js"
import { als } from "./6_roots.js"
import { type ScreenshotName, type ScreenshotOptions, screenshot } from "./11_screenshot.js"

type MatchersObject = Record<string, Matcher>
type ExpectResult = {
  matches: boolean
  received?: { value?: unknown; ariaSnapshot?: string }
  log?: string[]
  timedOut?: boolean
  errorMessage?: string
}
/** pw: the wire payload of Locator._expect / Frame._expect (PLAN §2.2). */
type ExpectPayload = {
  isNot: boolean
  timeout: number
  signal?: AbortSignal
  expectedText?: ExpectedText[]
  expectedNumber?: number
  expectedValue?: unknown
  expressionArg?: string
  useInnerText?: boolean
  pseudo?: string
}
/** pw: the private method both Locator and Frame carry; typed here once so no call site casts. */
type ExpectHost = { _expect(expression: string, options: ExpectPayload): Promise<ExpectResult> }
type Query = (isNot: boolean, timeout: number, signal?: AbortSignal) => Promise<ExpectResult>
type Ctx = MatcherState & { assertion?: unknown }
type Opts = Record<string, unknown>
type LocatorOpts = { timeout?: number }
type TextOpts = { timeout?: number; ignoreCase?: boolean; useInnerText?: boolean }
type Matcherish = (this: Ctx, ...args: never[]) => unknown

const host = (x: Locator | Frame): ExpectHost => x as unknown as ExpectHost
const isLocator = (x: unknown): x is Locator => {
  const o = x as { _expect?: unknown; _frame?: unknown } | null
  return !!o && typeof o._expect === "function" && typeof o._frame === "object"
}
const isPage = (x: unknown): x is Page => {
  const o = x as { mainFrame?: unknown; context?: unknown } | null
  return !!o && typeof o.mainFrame === "function" && typeof o.context === "function"
}
const isResponse = (x: unknown): x is APIResponse => !!x && typeof (x as { ok?: unknown }).ok === "function"
/** vitest: a matcher carrying this flag owns its own retry loop, so expect.poll hands it the receiver untouched. */
function takeover<F extends Matcherish>(m: F): F {
  Object.assign(m, { __vitest_poll_takeover__: true })
  return m
}

function scope() {
  const s = als.getStore()
  return {
    timeout: s?.root.options.$().expectTimeout ?? inject(KEY.options)?.expectTimeout ?? 5000,
    signal: s?.root.signal.$(),
  }
}
function guard(this: Ctx, name: string, receiver: unknown, kind: "Locator" | "Page" | "APIResponse") {
  if (receiver === null && this.assertion && flag(this.assertion, "_poll.fn"))
    throw new Error(
      `expect.poll() does not support "${name}". The matcher already retries; use { timeout } or vi.waitFor().`,
    )
  const ok = kind === "Locator" ? isLocator(receiver) : kind === "Page" ? isPage(receiver) : isResponse(receiver)
  if (!ok) throw new Error(`${name}: expected a playwright ${kind}, received ${typeName(receiver)}`)
}
function flag(assertion: unknown, key: string): unknown {
  return (assertion as { __flags?: Record<string, unknown> } | undefined)?.__flags?.[key]
}
const typeName = (x: unknown) =>
  x === null
    ? "null"
    : Array.isArray(x)
      ? "array"
      : typeof x === "object"
        ? ((x as object).constructor?.name ?? "object")
        : typeof x

type TextFlags = { matchSubstring?: boolean; ignoreCase?: boolean; normalizeWhiteSpace?: boolean }
export type ExpectedText = TextFlags & { string?: string; regexSource?: string; regexFlags?: string }
export function serializeExpectedText(items: unknown[], o: TextFlags = {}): ExpectedText[] {
  return items.map(i => ({
    string: typeof i === "string" ? i : undefined,
    regexSource: i instanceof RegExp ? i.source : undefined,
    regexFlags: i instanceof RegExp ? i.flags : undefined,
    matchSubstring: o.matchSubstring,
    ignoreCase: o.ignoreCase,
    normalizeWhiteSpace: o.normalizeWhiteSpace,
  }))
}

function format(
  name: string,
  receiver: string,
  expected: string,
  r: ExpectResult,
  timeout: number,
  isNot: boolean,
): string {
  const lines = [`expect(${receiver})${isNot ? ".not" : ""}.${name}() failed`, ""]
  if (receiver !== "page") lines.push(`Locator:  ${receiver}`)
  if (!r.errorMessage) {
    lines.push(`Expected: ${isNot ? "not " : ""}${expected}`)
    if (r.received && r.received.value !== undefined)
      lines.push(
        `Received: ${typeof r.received.value === "string" ? r.received.value : JSON.stringify(r.received.value)}`,
      )
  } else lines.push(r.errorMessage)
  if (r.timedOut) lines.push(`Timeout:  ${timeout}ms (exceeded)`)
  if (r.log?.length) lines.push("", "Call log:", ...r.log.map(l => `  - ${l}`))
  return lines.join("\n")
}

async function run(
  this: Ctx,
  name: string,
  receiver: Locator | Page,
  query: Query,
  expected: string,
  options: { timeout?: number },
) {
  const s = scope()
  const timeout = options.timeout ?? s.timeout
  const r = await query(this.isNot, timeout, s.signal)
  const label = isLocator(receiver) ? receiver.toString() : "page"
  return {
    pass: r.matches,
    message: () => format(name, label, expected, r, timeout, this.isNot),
    actual: r.received?.value,
    expected,
  }
}

type TruthyOpts = {
  negKey?: string
  negExpr?: string
  payload?: (o: Opts) => Partial<ExpectPayload>
  expected?: (o: Opts) => string
}
function truthy(name: string, expr: string, opts: TruthyOpts = {}) {
  return takeover(function (this: Ctx, locator: Locator, options: Opts = {}) {
    guard.call(this, name, locator, "Locator")
    const neg = opts.negKey && options[opts.negKey] === false
    const e = neg && opts.negExpr ? opts.negExpr : expr
    const payload = opts.payload?.(options) ?? {}
    return run.call(
      this,
      name,
      locator,
      (isNot, timeout, signal) => host(locator)._expect(e, { isNot, timeout, signal, ...payload }),
      opts.expected?.(options) ?? e.replace(/^to\.be\./, ""),
      options,
    )
  })
}
function text(
  name: string,
  expr: string,
  arrayExpr: string | undefined,
  flags: (o: Opts) => TextFlags,
  extra?: (o: Opts) => Partial<ExpectPayload>,
) {
  return takeover(function (this: Ctx, locator: Locator, expected: unknown, options: TextOpts = {}) {
    guard.call(this, name, locator, "Locator")
    const arr = Array.isArray(expected)
    if (arr && !arrayExpr) throw new Error(`${name} does not accept an array`)
    const expectedText = serializeExpectedText(arr ? expected : [expected], flags(options))
    const e = arr && arrayExpr ? arrayExpr : expr
    return run.call(
      this,
      name,
      locator,
      (isNot, timeout, signal) =>
        host(locator)._expect(e, {
          expectedText,
          isNot,
          timeout,
          signal,
          useInnerText: options.useInnerText,
          ...(extra?.(options) ?? {}),
        }),
      String(expected),
      options,
    )
  })
}
function withArg(
  name: string,
  presenceExpr: string | undefined,
  valueExpr: string,
  flags: (o: Opts) => TextFlags,
  extra?: (o: Opts) => Partial<ExpectPayload>,
) {
  return takeover(function (this: Ctx, locator: Locator, arg: string, expected?: unknown, options?: Opts) {
    guard.call(this, name, locator, "Locator")
    let value = expected
    let o = options
    if (o === undefined && presenceExpr && value !== null && typeof value === "object" && !(value instanceof RegExp)) {
      o = value as Opts
      value = undefined
    }
    o ??= {}
    if (value === undefined && presenceExpr)
      return run.call(
        this,
        name,
        locator,
        (isNot, timeout, signal) => host(locator)._expect(presenceExpr, { expressionArg: arg, isNot, timeout, signal }),
        `have attribute ${arg}`,
        o,
      )
    const expectedText = serializeExpectedText([value], flags(o))
    return run.call(
      this,
      name,
      locator,
      (isNot, timeout, signal) =>
        host(locator)._expect(valueExpr, {
          expressionArg: arg,
          expectedText,
          isNot,
          timeout,
          signal,
          ...(extra?.(o) ?? {}),
        }),
      `${arg}=${String(value)}`,
      o,
    )
  })
}

const ws = (o: Opts): TextFlags => ({ normalizeWhiteSpace: true, ignoreCase: o.ignoreCase as boolean | undefined })
const none = (): TextFlags => ({})

export const playwrightMatchers: MatchersObject = {
  toBeAttached: truthy("toBeAttached", "to.be.attached", {
    negKey: "attached",
    negExpr: "to.be.detached",
    expected: o => (o?.attached === false ? "detached" : "attached"),
  }),
  toBeChecked: truthy("toBeChecked", "to.be.checked", {
    payload: o => {
      if (o?.indeterminate && o?.checked === false)
        throw new Error("Can't assert indeterminate and checked at the same time")
      return { expectedValue: { checked: o?.checked, indeterminate: o?.indeterminate } }
    },
    expected: o => (o?.indeterminate ? "indeterminate" : o?.checked === false ? "unchecked" : "checked"),
  }),
  toBeDisabled: truthy("toBeDisabled", "to.be.disabled"),
  toBeEditable: truthy("toBeEditable", "to.be.editable", {
    negKey: "editable",
    negExpr: "to.be.readonly",
    expected: o => (o?.editable === false ? "readOnly" : "editable"),
  }),
  toBeEmpty: truthy("toBeEmpty", "to.be.empty"),
  toBeEnabled: truthy("toBeEnabled", "to.be.enabled", {
    negKey: "enabled",
    negExpr: "to.be.disabled",
    expected: o => (o?.enabled === false ? "disabled" : "enabled"),
  }),
  toBeFocused: truthy("toBeFocused", "to.be.focused"),
  toBeHidden: truthy("toBeHidden", "to.be.hidden"),
  toBeVisible: truthy("toBeVisible", "to.be.visible", {
    negKey: "visible",
    negExpr: "to.be.hidden",
    expected: o => (o?.visible === false ? "hidden" : "visible"),
  }),
  toBeInViewport: truthy("toBeInViewport", "to.be.in.viewport", {
    payload: o => ({ expectedNumber: o.ratio as number | undefined }),
    expected: () => "in viewport",
  }),

  toHaveText: text("toHaveText", "to.have.text", "to.have.text.array", ws),
  toContainText: text("toContainText", "to.have.text", "to.contain.text.array", o => ({
    ...ws(o),
    matchSubstring: true,
  })),
  toHaveClass: text("toHaveClass", "to.have.class", "to.have.class.array", none),
  toContainClass: (() => {
    const inner = text("toContainClass", "to.contain.class", "to.contain.class.array", none)
    return takeover(function (this: Ctx, locator: Locator, expected: unknown, options?: TextOpts) {
      if (expected instanceof RegExp) throw new Error(`"expected" argument in toContainClass cannot be a RegExp value`)
      if (Array.isArray(expected) && expected.some(e => e instanceof RegExp))
        throw new Error(`"expected" argument in toContainClass cannot contain RegExp values`)
      return inner.call(this, locator, expected, options)
    })
  })(),
  toHaveId: text("toHaveId", "to.have.id", undefined, none),
  toHaveRole: (() => {
    const inner = text("toHaveRole", "to.have.role", undefined, none)
    return takeover(function (this: Ctx, locator: Locator, expected: unknown, options?: TextOpts) {
      if (typeof expected !== "string") throw new Error(`"role" argument in toHaveRole must be a string`)
      return inner.call(this, locator, expected, options)
    })
  })(),
  toHaveValue: text("toHaveValue", "to.have.value", undefined, none),
  toHaveValues: text("toHaveValues", "to.have.values", "to.have.values", none),
  toHaveAccessibleName: text("toHaveAccessibleName", "to.have.accessible.name", undefined, ws),
  toHaveAccessibleDescription: text("toHaveAccessibleDescription", "to.have.accessible.description", undefined, ws),
  toHaveAccessibleErrorMessage: text("toHaveAccessibleErrorMessage", "to.have.accessible.error.message", undefined, ws),
  toHaveAttribute: withArg("toHaveAttribute", "to.have.attribute", "to.have.attribute.value", o => ({
    ignoreCase: o.ignoreCase as boolean | undefined,
  })),
  toHaveCSS: withArg("toHaveCSS", undefined, "to.have.css", none, o => ({ pseudo: o.pseudo as string | undefined })),

  toHaveCount: takeover(function (this: Ctx, locator: Locator, expected: number, options: LocatorOpts = {}) {
    guard.call(this, "toHaveCount", locator, "Locator")
    return run.call(
      this,
      "toHaveCount",
      locator,
      (isNot, timeout, signal) =>
        host(locator)._expect("to.have.count", { expectedNumber: expected, isNot, timeout, signal }),
      String(expected),
      options,
    )
  }),
  toHaveJSProperty: takeover(function (
    this: Ctx,
    locator: Locator,
    name: string,
    expected: unknown,
    options: LocatorOpts = {},
  ) {
    guard.call(this, "toHaveJSProperty", locator, "Locator")
    return run.call(
      this,
      "toHaveJSProperty",
      locator,
      (isNot, timeout, signal) =>
        host(locator)._expect("to.have.property", {
          expressionArg: name,
          expectedValue: expected,
          isNot,
          timeout,
          signal,
        }),
      `${name}=${JSON.stringify(expected)}`,
      options,
    )
  }),

  toHaveTitle: takeover(function (this: Ctx, page: Page, expected: string | RegExp, options: LocatorOpts = {}) {
    guard.call(this, "toHaveTitle", page, "Page")
    const expectedText = serializeExpectedText([expected], { normalizeWhiteSpace: true })
    return run.call(
      this,
      "toHaveTitle",
      page,
      (isNot, timeout, signal) =>
        host(page.mainFrame())._expect("to.have.title", { expectedText, isNot, timeout, signal }),
      String(expected),
      options,
    )
  }),
  toHaveURL: takeover(async function (
    this: Ctx,
    page: Page,
    expected: string | RegExp | URLPattern | ((url: URL) => boolean),
    options: LocatorOpts & { ignoreCase?: boolean } = {},
  ) {
    guard.call(this, "toHaveURL", page, "Page")
    const s = scope()
    const timeout = options.timeout ?? s.timeout
    if (
      typeof expected === "function" ||
      (typeof expected === "object" && expected !== null && !(expected instanceof RegExp))
    ) {
      const pred = typeof expected === "function" ? expected : (u: URL) => (expected as URLPattern).test(u.href)
      let last = ""
      const isNot = this.isNot
      // pw: waitForURL accepts the abort signal at runtime (playwright's own matcher passes it); the public type omits it
      const wait = page.mainFrame().waitForURL as (
        url: (u: URL) => boolean,
        o: { timeout: number; signal?: AbortSignal },
      ) => Promise<void>
      try {
        await wait.call(
          page.mainFrame(),
          u => {
            last = u.toString()
            return isNot ? !pred(u) : pred(u)
          },
          { timeout, signal: s.signal },
        )
        return { pass: !isNot, message: () => "" }
      } catch {
        return {
          pass: isNot,
          message: () =>
            `expect(page)${isNot ? ".not" : ""}.toHaveURL(predicate) failed\n\nReceived: ${last || page.url()}\nTimeout:  ${timeout}ms`,
        }
      }
    }
    const baseURL = (page.context() as unknown as { _options?: { baseURL?: string } })._options?.baseURL
    const exp = typeof expected === "string" && baseURL ? new URL(expected, baseURL).toString() : expected
    const expectedText = serializeExpectedText([exp], { ignoreCase: options.ignoreCase })
    return run.call(
      this,
      "toHaveURL",
      page,
      (isNot, t, signal) => host(page.mainFrame())._expect("to.have.url", { expectedText, isNot, timeout: t, signal }),
      String(exp),
      options,
    )
  }),

  toHaveScreenshot: takeover(function (
    this: Ctx,
    receiver: Page | Locator,
    nameOrOptions?: ScreenshotName | ScreenshotOptions,
    options?: ScreenshotOptions,
  ) {
    if (receiver === null && this.assertion && flag(this.assertion, "_poll.fn"))
      throw new Error(
        'expect.poll() does not support "toHaveScreenshot". The matcher already retries; use { timeout }.',
      )
    if (!isPage(receiver) && !isLocator(receiver))
      throw new Error(`toHaveScreenshot: expected a playwright Page or Locator, received ${typeName(receiver)}`)
    return screenshot.call(this, receiver, nameOrOptions, options)
  }),
  toBeOK: async function (this: Ctx, response: APIResponse) {
    guard.call(this, "toBeOK", response, "APIResponse")
    const pass = response.ok()
    return {
      pass,
      message: () =>
        `expect(response)${this.isNot ? ".not" : ""}.toBeOK() failed\n\nReceived: ${response.status()} ${response.statusText()} ${response.url()}`,
    }
  },
  toPass: async function (this: Ctx, cb: () => unknown, options: { timeout?: number; intervals?: number[] } = {}) {
    if (typeof cb !== "function") throw new Error("toPass: expected a function")
    const s = scope()
    const r = await lastValueFrom(
      poll$(cb, {
        intervals: options.intervals ?? [100, 250, 500, 1000],
        timeout: options.timeout ?? 0,
        isNot: this.isNot,
        signal: s.signal,
      }),
    )
    const pass = r === "pass" ? !this.isNot : this.isNot
    return {
      pass,
      message: () =>
        `expect(callback)${this.isNot ? ".not" : ""}.toPass() failed: ${r === "timeout" ? (options.timeout ? `timeout ${options.timeout}ms exceeded` : "the test deadline passed") : "callback settled the other way"}`,
    }
  },
}

/** `R` is unused: vitest merges `Assertion<T>` with this interface, so the parameter must exist. */
// biome-ignore lint/correctness/noUnusedVariables: see above
export interface PlaywrightMatchers<R> {
  toBeAttached(o?: LocatorOpts & { attached?: boolean }): Promise<void>
  toBeChecked(o?: LocatorOpts & { checked?: boolean; indeterminate?: boolean }): Promise<void>
  toBeDisabled(o?: LocatorOpts): Promise<void>
  toBeEditable(o?: LocatorOpts & { editable?: boolean }): Promise<void>
  toBeEmpty(o?: LocatorOpts): Promise<void>
  toBeEnabled(o?: LocatorOpts & { enabled?: boolean }): Promise<void>
  toBeFocused(o?: LocatorOpts): Promise<void>
  toBeHidden(o?: LocatorOpts): Promise<void>
  toBeVisible(o?: LocatorOpts & { visible?: boolean }): Promise<void>
  toBeInViewport(o?: LocatorOpts & { ratio?: number }): Promise<void>
  toHaveText(expected: string | RegExp | Array<string | RegExp>, o?: TextOpts): Promise<void>
  toContainText(expected: string | RegExp | Array<string | RegExp>, o?: TextOpts): Promise<void>
  toHaveClass(expected: string | RegExp | Array<string | RegExp>, o?: LocatorOpts): Promise<void>
  toContainClass(expected: string | string[], o?: LocatorOpts): Promise<void>
  toHaveId(expected: string | RegExp, o?: LocatorOpts): Promise<void>
  toHaveRole(expected: string, o?: LocatorOpts): Promise<void>
  toHaveValue(expected: string | RegExp, o?: LocatorOpts): Promise<void>
  toHaveValues(expected: Array<string | RegExp>, o?: LocatorOpts): Promise<void>
  toHaveAccessibleName(expected: string | RegExp, o?: LocatorOpts & { ignoreCase?: boolean }): Promise<void>
  toHaveAccessibleDescription(expected: string | RegExp, o?: LocatorOpts & { ignoreCase?: boolean }): Promise<void>
  toHaveAccessibleErrorMessage(expected: string | RegExp, o?: LocatorOpts & { ignoreCase?: boolean }): Promise<void>
  toHaveAttribute(
    name: string,
    expected?: string | RegExp | (LocatorOpts & { ignoreCase?: boolean }),
    o?: LocatorOpts & { ignoreCase?: boolean },
  ): Promise<void>
  toHaveCSS(name: string, expected: string | RegExp, o?: LocatorOpts & { pseudo?: string }): Promise<void>
  toHaveCount(expected: number, o?: LocatorOpts): Promise<void>
  toHaveJSProperty(name: string, expected: unknown, o?: LocatorOpts): Promise<void>
  toHaveTitle(expected: string | RegExp, o?: LocatorOpts): Promise<void>
  toHaveURL(
    expected: string | RegExp | URLPattern | ((url: URL) => boolean),
    o?: LocatorOpts & { ignoreCase?: boolean },
  ): Promise<void>
  toHaveScreenshot(name?: ScreenshotName | ScreenshotOptions, o?: ScreenshotOptions): Promise<void>
  toBeOK(): Promise<void>
  toPass(o?: { timeout?: number; intervals?: number[] }): Promise<void>
}

type Chainable = { toHaveScreenshot: (...args: unknown[]) => unknown }
const aliased = Symbol.for("vitest-playwright:toMatchSnapshot")
/** `expect(page).toMatchSnapshot()` / `expect(locator).toMatchSnapshot("name")` become toHaveScreenshot; every other
 *  receiver keeps vitest's own snapshot matcher. Installed once per process (setup.ts). */
export function installSnapshotAlias(): void {
  const proto = chai.Assertion.prototype as unknown as {
    [aliased]?: true
    toMatchSnapshot?: (this: object, ...args: unknown[]) => unknown
  }
  const original = proto.toMatchSnapshot
  if (!original || proto[aliased]) return
  proto[aliased] = true
  chai.util.addMethod(chai.Assertion.prototype, "toMatchSnapshot", function (this: object, ...args: unknown[]) {
    const receiver = chai.util.flag(this, "object")
    if (isPage(receiver) || isLocator(receiver)) return (this as Chainable).toHaveScreenshot(...args)
    return original.apply(this, args)
  })
}
declare module "vitest" {
  // biome-ignore lint/suspicious/noExplicitAny: must match vitest's own `Assertion<T = any>` declaration to merge
  interface Assertion<T = any> extends PlaywrightMatchers<T> {}
}
