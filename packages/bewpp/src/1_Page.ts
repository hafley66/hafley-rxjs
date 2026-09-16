import type { BirpcReturn } from "birpc"
import type {
  BridgeEvents,
  DomCommand,
  ExtensionCommands,
  ImageAsset,
  LocatorControls,
  LocatorQuery,
  ObservationBatch,
  ObservationOptions,
  PageControls,
  PageImage,
  TabInfo,
} from "./0_controls.js"

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
  getByRole(role: string, options: { name?: string } = {}) {
    return new ExtensionLocator(this, { role, name: options.name })
  }
  getByPlaceholder(placeholder: string) {
    return new ExtensionLocator(this, { placeholder })
  }
  getByLabel(label: string) {
    return new ExtensionLocator(this, { label })
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
  async resolveSelector(selector: string, options: { strict?: boolean; frameId?: number } = {}) {
    return this.rpc.resolveWithSelectorEngine(this.id, { selector, ...options })
  }
  async evaluate<R = unknown>(source: string, args: unknown[] = []): Promise<R> {
    return (await this.rpc.evaluateInPage(this.id, source, args)) as R
  }
  async readStorage(kind: "localStorage" | "sessionStorage", key: string) {
    return this.evaluate<string | null>("(kind, key) => window[kind].getItem(key)", [kind, key])
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
  getByRole(role: string, options: { name?: string } = {}) {
    return new ExtensionLocator(this.page, { role, name: options.name, within: this.query })
  }
  first() {
    return new ExtensionLocator(this.page, { ...this.query, index: 0 })
  }
  last() {
    return new ExtensionLocator(this.page, { ...this.query, last: true })
  }
  async textContent() {
    return (await this.execute("text")) as string | null
  }
  async getAttribute(name: string) {
    return (await this.execute("attribute", { value: name })) as string | null
  }
  async isChecked() {
    return (await this.execute("checked")) as boolean
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
  async execute(
    action: Extract<DomCommand, { op: "query" }>["action"],
    options: Omit<Extract<DomCommand, { op: "query" }>, "op" | "query" | "action"> = {},
  ) {
    return this.page.rpc.execute(this.page.id, { op: "query", query: this.query, action, ...options })
  }
  async count() {
    return (await this.execute("count")) as number
  }
  async isVisible() {
    return (await this.execute("visible")) as boolean
  }
  async isEnabled() {
    return (await this.execute("enabled")) as boolean
  }
  async inputValue() {
    return (await this.execute("value")) as string
  }
  async allTextContents() {
    return (await this.execute("texts")) as string[]
  }
  async click(options: { timeout?: number; allowSubmit?: boolean } = {}) {
    await this.execute("click", { timeoutMs: options.timeout, allowSubmit: options.allowSubmit })
  }
  async fill(value: string, options: { timeout?: number } = {}) {
    await this.execute("fill", { value, timeoutMs: options.timeout })
  }
  async selectOption(value: { label: string }, options: { timeout?: number } = {}) {
    await this.execute("select", { value: value.label, timeoutMs: options.timeout })
  }
  async press(value: string) {
    await this.execute("press", { value })
  }
  async hover() {
    await this.execute("hover")
  }
  async waitFor(options: { state: "visible" | "hidden" | "detached"; timeout: number }) {
    await this.execute("wait", { state: options.state, timeoutMs: options.timeout })
  }
}
