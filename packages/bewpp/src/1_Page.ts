import { setTimeout as sleep } from "node:timers/promises"
import type { BirpcReturn } from "birpc"
import {
  type ActionOptions,
  type BridgeEvents,
  type ClickOptions,
  type DomCommand,
  type ExtensionCommands,
  type ImageAsset,
  LOCATOR_POLL_MS,
  LOCATOR_TIMEOUT_MS,
  type LocatorControls,
  type LocatorQuery,
  MISSING_ENGINE_MESSAGE,
  type ObservationBatch,
  type ObservationOptions,
  oneElementMessage,
  type PageControls,
  type PageImage,
  type ScreenshotOptions,
  type TabInfo,
  type TimeoutOptions,
} from "./0_controls.js"
import { playwrightSelector } from "./0_selectors.js"

type QueryCommand = Extract<DomCommand, { op: "query" }>
type QueryAction = QueryCommand["action"]
type QueryOptions = Omit<QueryCommand, "op" | "query" | "action">

/**
 * Playwright's option bags are wider than MV3 honors. Anything that would silently change an action's
 * meaning is refused; `force` and `noWaitAfter` describe checks this package does not perform, and
 * `delay` is forwarded to user-event.
 */
function refuseUnsupported(options: ActionOptions) {
  if (options.trial) throw new Error("trial is unsupported: no actionability check runs before the action.")
  for (const name of ["button", "clickCount", "modifiers", "position", "steps"] as const)
    if (options[name] != null) throw new Error(`${name} is unsupported.`)
}

type Rpc = BirpcReturn<ExtensionCommands, BridgeEvents>
export class ExtensionPage implements PageControls {
  id: number
  rpc: Rpc
  tabs: () => TabInfo[]
  constructor(id: number, rpc: Rpc, tabs: () => TabInfo[]) {
    this.id = id
    this.rpc = rpc
    this.tabs = tabs
  }
  url() {
    return this.tabs().find(tab => tab.id === this.id)?.url ?? ""
  }
  isClosed() {
    return !this.tabs().some(tab => tab.id === this.id)
  }
  getByRole(role: string, options: { name?: string; exact?: boolean } = {}) {
    return new ExtensionLocator(this, { role, name: options.name, exact: options.exact })
  }
  getByPlaceholder(placeholder: string, options: { exact?: boolean } = {}) {
    return new ExtensionLocator(this, { placeholder, exact: options.exact })
  }
  getByLabel(label: string, options: { exact?: boolean } = {}) {
    return new ExtensionLocator(this, { label, exact: options.exact })
  }
  getByTestId(testid: string) {
    return new ExtensionLocator(this, { testid })
  }
  locator(selector: string) {
    return new ExtensionLocator(this, { selector })
  }
  async goto(url: string) {
    await this.rpc.navigate(this.id, url)
  }
  async bringToFront() {
    await this.rpc.activate(this.id)
  }
  async waitForURL(pattern: RegExp, { timeout }: { timeout: number }) {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      const url = await this.rpc.execute(this.id, { op: "location" }).catch(() => "")
      if (typeof url === "string" && pattern.test(url)) {
        const tab = this.tabs().find(tab => tab.id === this.id)
        if (tab) tab.url = url
        return
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error("Timed out waiting for page navigation.")
  }
  inspect() {
    return this.rpc.execute(this.id, { op: "inspect" })
  }
  async images() {
    return (await this.rpc.execute(this.id, { op: "images" })) as PageImage[]
  }
  async download(url: string): Promise<ImageAsset> {
    try {
      return (await this.rpc.execute(this.id, { op: "download", url })) as ImageAsset
    } catch {
      if (!url.startsWith("https://")) throw new Error("Could not download the page image.")
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
      const mime = response.headers.get("content-type")?.split(";")[0]
      const buffer = Buffer.from(await response.arrayBuffer())
      if (!response.ok || !mime?.startsWith("image/") || buffer.length > 32 * 1024 * 1024)
        throw new Error("Could not download the page image.")
      return { mime, base64: buffer.toString("base64") }
    }
  }
  async observe(options: ObservationOptions) {
    return (await this.rpc.execute(this.id, { op: "observe", action: "start", ...options })) as ObservationBatch
  }
  async readObservations(options: { afterSequence?: number; limit?: number } = {}) {
    return (await this.rpc.execute(this.id, { op: "observe", action: "read", ...options })) as ObservationBatch
  }
  async stopObserving() {
    return (await this.rpc.execute(this.id, { op: "observe", action: "stop" })) as ObservationBatch
  }
  async installSelectorEngine(source: string, options: { frameId?: number } = {}) {
    return this.rpc.installSelectorEngine(this.id, source, options.frameId)
  }
  /**
   * Engine resolution that reports installation instead of requiring it, so a locator can fall back to
   * Testing Library resolution on a page that never installed the engine.
   */
  async resolveWithEngine(selector: string, options: { strict?: boolean; frameId?: number } = {}) {
    return this.rpc.resolveWithSelectorEngine(this.id, { selector, ...options })
  }
  async resolveSelector(selector: string, options: { strict?: boolean; frameId?: number } = {}) {
    const resolved = await this.resolveWithEngine(selector, options)
    if (!resolved.installed) throw new Error(MISSING_ENGINE_MESSAGE)
    return resolved
  }
  async evaluate<R = unknown>(source: string, args: unknown[] = []): Promise<R> {
    return (await this.rpc.evaluateInPage(this.id, source, args)) as R
  }
  async readStorage(kind: "localStorage" | "sessionStorage", key: string) {
    return this.evaluate<string | null>("(kind, key) => window[kind].getItem(key)", [kind, key])
  }
  async screenshot(options: ScreenshotOptions = {}) {
    return this.rpc.capturePage(this.id, options)
  }
  async snapshotStorage(kind: "localStorage" | "sessionStorage") {
    return this.evaluate<Record<string, string>>("(kind) => Object.fromEntries(Object.entries({ ...window[kind] }))", [
      kind,
    ])
  }
}

export class ExtensionLocator implements LocatorControls {
  page: ExtensionPage
  query: LocatorQuery
  constructor(page: ExtensionPage, query: LocatorQuery) {
    this.page = page
    this.query = query
  }
  getByRole(role: string, options: { name?: string; exact?: boolean } = {}) {
    return new ExtensionLocator(this.page, {
      role,
      name: options.name,
      exact: options.exact,
      within: this.query,
    })
  }
  first() {
    return new ExtensionLocator(this.page, { ...this.query, index: 0 })
  }
  last() {
    return new ExtensionLocator(this.page, { ...this.query, last: true })
  }
  filter(options: { has?: LocatorControls; visible?: boolean }) {
    return new ExtensionLocator(this.page, {
      ...this.query,
      ...(options.has ? { has: options.has.query } : {}),
      ...(options.visible != null ? { visible: options.visible } : {}),
    })
  }
  nth(index: number) {
    return new ExtensionLocator(this.page, { ...this.query, index })
  }
  /** The Playwright selector this query compiles to. The engine resolves it; the content script never sees it. */
  get selector() {
    return playwrightSelector(this.query)
  }
  /**
   * Resolution through the injected engine, or `null` when this page has no engine installed. Strict
   * resolutions carry the engine's own strict-mode violation text.
   */
  async #engine(selector: string, strict: boolean) {
    const resolved = await this.page.resolveWithEngine(selector, { strict })
    return resolved.installed ? resolved : null
  }
  /**
   * Strict single-element resolution for one operation, or `null` when no engine is installed. A render
   * may be pending, so a locator that matches nothing yet polls until the budget expires — the same
   * patience the content script shows when it resolves the query itself. `budget` is what is left of
   * that timeout for the action that follows.
   */
  async #single(timeoutMs: number) {
    const selector = this.selector
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const resolved = await this.#engine(selector, true)
      if (!resolved) return null
      if (resolved.count === 1) return { marker: resolved.marker, budget: Math.max(1, deadline - Date.now()) }
      if (Date.now() >= deadline) throw new Error(oneElementMessage(resolved.count))
      await sleep(LOCATOR_POLL_MS)
    }
  }
  /**
   * Runs a content-script action. `marker` addresses the elements the engine tagged for this operation;
   * without it the content script resolves the query itself through Testing Library.
   */
  async execute(action: QueryAction, options: QueryOptions = {}, marker?: string) {
    return this.page.rpc.execute(this.page.id, {
      op: "query",
      query: marker ? { marker } : this.query,
      action,
      ...options,
    })
  }
  async count(options: TimeoutOptions = {}) {
    const resolved = await this.#engine(this.selector, false)
    if (resolved) return resolved.count
    return (await this.execute("count", { timeoutMs: options.timeout })) as number
  }
  async allTextContents() {
    const resolved = await this.#engine(this.selector, false)
    if (resolved) return (await this.execute("texts", {}, resolved.marker)) as string[]
    return (await this.execute("texts")) as string[]
  }
  async textContent(options: TimeoutOptions = {}) {
    const resolved = await this.#single(options.timeout ?? LOCATOR_TIMEOUT_MS)
    return (await (resolved
      ? this.execute("text", { timeoutMs: resolved.budget }, resolved.marker)
      : this.execute("text", { timeoutMs: options.timeout }))) as string | null
  }
  async getAttribute(name: string, options: TimeoutOptions = {}) {
    const resolved = await this.#single(options.timeout ?? LOCATOR_TIMEOUT_MS)
    return (await (resolved
      ? this.execute("attribute", { value: name, timeoutMs: resolved.budget }, resolved.marker)
      : this.execute("attribute", { value: name, timeoutMs: options.timeout }))) as string | null
  }
  async isChecked(options: TimeoutOptions = {}) {
    const resolved = await this.#single(options.timeout ?? LOCATOR_TIMEOUT_MS)
    return (await (resolved
      ? this.execute("checked", { timeoutMs: resolved.budget }, resolved.marker)
      : this.execute("checked", { timeoutMs: options.timeout }))) as boolean
  }
  async isVisible(options: TimeoutOptions = {}) {
    const timeout = options.timeout ?? LOCATOR_TIMEOUT_MS
    const deadline = Date.now() + timeout
    const selector = this.selector
    for (;;) {
      const resolved = await this.#engine(selector, true)
      if (!resolved) return (await this.execute("visible", { timeoutMs: options.timeout })) as boolean
      if (resolved.count === 1)
        return (await this.execute(
          "visible",
          { timeoutMs: Math.max(1, deadline - Date.now()) },
          resolved.marker,
        )) as boolean
      if (Date.now() >= deadline) return false
      await sleep(LOCATOR_POLL_MS)
    }
  }
  async isEnabled(options: TimeoutOptions = {}) {
    const resolved = await this.#single(options.timeout ?? LOCATOR_TIMEOUT_MS)
    return (await (resolved
      ? this.execute("enabled", { timeoutMs: resolved.budget }, resolved.marker)
      : this.execute("enabled", { timeoutMs: options.timeout }))) as boolean
  }
  async inputValue(options: TimeoutOptions = {}) {
    const resolved = await this.#single(options.timeout ?? LOCATOR_TIMEOUT_MS)
    return (await (resolved
      ? this.execute("value", { timeoutMs: resolved.budget }, resolved.marker)
      : this.execute("value", { timeoutMs: options.timeout }))) as string
  }
  async click(options: ClickOptions = {}) {
    refuseUnsupported(options)
    const timeout = options.timeout ?? LOCATOR_TIMEOUT_MS
    const resolved = await this.#single(timeout)
    await this.execute(
      "click",
      {
        timeoutMs: resolved?.budget ?? timeout,
        delayMs: options.delay,
        allowSubmit: options.allowSubmit,
      },
      resolved?.marker,
    )
  }
  async fill(value: string, options: ActionOptions = {}) {
    refuseUnsupported(options)
    const timeout = options.timeout ?? LOCATOR_TIMEOUT_MS
    const resolved = await this.#single(timeout)
    await this.execute(
      "fill",
      { value, timeoutMs: resolved?.budget ?? timeout, delayMs: options.delay },
      resolved?.marker,
    )
  }
  async selectOption(value: { label: string }, options: ActionOptions = {}) {
    refuseUnsupported(options)
    const timeout = options.timeout ?? LOCATOR_TIMEOUT_MS
    const resolved = await this.#single(timeout)
    await this.execute(
      "select",
      { value: value.label, timeoutMs: resolved?.budget ?? timeout, delayMs: options.delay },
      resolved?.marker,
    )
  }
  async press(value: string, options: ActionOptions = {}) {
    refuseUnsupported(options)
    const timeout = options.timeout ?? LOCATOR_TIMEOUT_MS
    const resolved = await this.#single(timeout)
    await this.execute(
      "press",
      { value, timeoutMs: resolved?.budget ?? timeout, delayMs: options.delay },
      resolved?.marker,
    )
  }
  async hover(options: ActionOptions = {}) {
    refuseUnsupported(options)
    const timeout = options.timeout ?? LOCATOR_TIMEOUT_MS
    const resolved = await this.#single(timeout)
    await this.execute("hover", { timeoutMs: resolved?.budget ?? timeout }, resolved?.marker)
  }
  async waitFor(options: { state?: "attached" | "detached" | "hidden" | "visible"; timeout?: number } = {}) {
    const state = options.state ?? "visible"
    const timeout = options.timeout ?? LOCATOR_TIMEOUT_MS
    const deadline = Date.now() + timeout
    const selector = this.selector
    for (;;) {
      // Detached and hidden are satisfied by a set that matches nothing, so neither may be strict.
      const resolved = await this.#engine(selector, state === "visible" || state === "attached")
      if (!resolved) break
      const visible = resolved.count > 0 && ((await this.execute("visible", {}, resolved.marker)) as boolean)
      const ready =
        state === "detached"
          ? resolved.count === 0
          : state === "attached"
            ? resolved.count === 1
            : state === "visible"
              ? resolved.count === 1 && visible
              : !visible
      if (ready) return
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${selector} to be ${state}.`)
      await sleep(LOCATOR_POLL_MS)
    }
    await this.execute("wait", { state, timeoutMs: options.timeout })
  }
}
