export type LocatorQuery = {
  role?: string
  name?: string
  placeholder?: string
  label?: string
  testid?: string
  selector?: string
  within?: LocatorQuery
  has?: LocatorQuery
  visible?: boolean
  index?: number
}
export type ImageAsset = { mime: string; base64: string }
export type PageImage = { src: string; width: number; height: number }
export type TabInfo = { id: number; url: string; title: string; active: boolean }
export type ObservationSource = "dom" | "localStorage" | "sessionStorage" | "indexedDB"
export type ObservationOptions = {
  sources: ObservationSource[]
  selector?: string
  includeValues?: boolean
  debounceMs?: number
  maxEvents?: number
  textLimit?: number
}
export type PageObservationEvent = {
  sequence: number
  timestamp: number
  source: ObservationSource
  operation?: string
  selector?: string
  database?: string | null
  store?: string
  key?: string | null
  oldValue?: string | null
  newValue?: string | null
  value?: string | null
  text?: string
}
export type ObservationBatch = {
  active: boolean
  events: PageObservationEvent[]
  cursor: number
  oldestSequence: number | null
  newestSequence: number | null
  dropped: number
  hasMore: boolean
}
export type DomCommand =
  | { op: "inspect" | "images" | "location" }
  | { op: "download"; url: string }
  | ({ op: "observe" } & (
      | ({ action: "start" } & ObservationOptions)
      | { action: "read"; afterSequence?: number; limit?: number }
      | { action: "stop" }
    ))
  | {
      op: "query"
      query: LocatorQuery
      action:
        | "count"
        | "visible"
        | "enabled"
        | "value"
        | "texts"
        | "click"
        | "fill"
        | "select"
        | "press"
        | "hover"
        | "wait"
      value?: string
      state?: "visible" | "hidden" | "detached"
      timeoutMs?: number
      allowSubmit?: boolean
    }

export interface LocatorControls {
  query: LocatorQuery
  getByRole(role: string, options?: { name?: string; exact?: true }): LocatorControls
  filter(options: { has?: LocatorControls; visible?: boolean }): LocatorControls
  nth(index: number): LocatorControls
  count(): Promise<number>
  isVisible(): Promise<boolean>
  isEnabled(): Promise<boolean>
  inputValue(): Promise<string>
  allTextContents(): Promise<string[]>
  click(options?: { timeout?: number; allowSubmit?: boolean }): Promise<void>
  fill(value: string, options?: { timeout?: number }): Promise<void>
  selectOption(value: { label: string }, options?: { timeout?: number }): Promise<void>
  press(value: string): Promise<void>
  hover(): Promise<void>
  waitFor(options: { state: "visible" | "hidden" | "detached"; timeout: number }): Promise<void>
}
export interface PageControls {
  url(): string
  isClosed(): boolean
  getByRole(role: string, options?: { name?: string; exact?: true }): LocatorControls
  getByPlaceholder(value: string, options?: { exact?: true }): LocatorControls
  getByLabel(value: string, options?: { exact?: true }): LocatorControls
  getByTestId(value: string): LocatorControls
  locator(selector: string): LocatorControls
  goto(url: string): Promise<void>
  bringToFront(): Promise<void>
  waitForURL(pattern: RegExp, options: { timeout: number }): Promise<void>
  inspect(): Promise<unknown>
  images(): Promise<PageImage[]>
  download(url: string): Promise<ImageAsset>
  observe(options: ObservationOptions): Promise<ObservationBatch>
  readObservations(options?: { afterSequence?: number; limit?: number }): Promise<ObservationBatch>
  stopObserving(): Promise<ObservationBatch>
}
export interface ExtensionCommands {
  tabs(): Promise<TabInfo[]>
  execute(tabId: number, command: DomCommand): Promise<unknown>
  open(url: string): Promise<TabInfo>
  navigate(tabId: number, url: string): Promise<void>
  activate(tabId: number): Promise<void>
}
export interface BridgeEvents {
  changed(tabs: TabInfo[]): void
  ping(): void
}
