export type LocatorQuery = {
  role?: string
  name?: string
  /** Case-sensitive matching for `name`/`label`/`placeholder`, mirroring Playwright's `exact`. */
  exact?: boolean
  placeholder?: string
  label?: string
  testid?: string
  selector?: string
  within?: LocatorQuery
  has?: LocatorQuery
  visible?: boolean
  index?: number
  /** Selects the final match of the filtered set, after `has`/`visible` filters. */
  last?: boolean
  /**
   * The elements the injected engine tagged `data-bewpp-hit="<marker>-<index>"` for this operation,
   * addressed in the engine's own resolve order. The engine resolves selectors and the content script
   * acts, so the marker is the only handle both worlds share.
   */
  marker?: string
}

/** Default budget for one locator operation, shared by the host façade and the content script. */
export const LOCATOR_TIMEOUT_MS = 5_000

/** Poll interval for a locator that has to wait for the document to catch up. */
export const LOCATOR_POLL_MS = 100

/** Text for a strict single-element resolution that matched nothing, from either side of the bridge. */
export const oneElementMessage = (count: number) => `Expected one element; found ${count}.`

/** `ExtensionPage.resolveSelector` raises this when the page never installed the injected engine. */
export const MISSING_ENGINE_MESSAGE = "Install the selector engine before resolving Playwright selectors."
export type ImageAsset = { mime: string; base64: string }
export type PageImage = { src: string; width: number; height: number }
export type TabInfo = { id: number; url: string; title: string; active: boolean }
export type ObservationSource = "dom" | "localStorage" | "sessionStorage" | "indexedDB" | "click"
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
  /** Click events only: a Playwright selector for the clicked element, when the engine is installed. */
  playwrightSelector?: string
  /** Click events only: fallback selectors to try in order. */
  candidates?: string[]
  /** Click events only: the clicked element's ancestry, innermost first. */
  path?: { tag: string; role: string | null; name: string | null; id: string | null }[]
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
        | "text"
        | "attribute"
        | "checked"
        | "click"
        | "fill"
        | "select"
        | "press"
        | "hover"
        | "wait"
      value?: string
      state?: "visible" | "hidden" | "attached" | "detached"
      timeoutMs?: number
      /** Milliseconds between the pointer or key down and up phases, forwarded to user-event. */
      delayMs?: number
      allowSubmit?: boolean
    }

/** Timeout budget, accepted wherever Playwright accepts `TimeoutOptions`. */
export type TimeoutOptions = { timeout?: number }

/**
 * Options Playwright's mutating locator actions accept. `delay` is forwarded to user-event. `force`
 * and `noWaitAfter` describe checks this package never performs, so they change nothing. The rest
 * would silently change the action's meaning, so any value is refused at the call.
 */
export type ActionOptions = TimeoutOptions & {
  delay?: number
  force?: boolean
  noWaitAfter?: boolean
  /** Unsupported: a trial action must not perform the action, and no actionability check exists to run. */
  trial?: boolean
  /** Unsupported: only the left button is used. */
  button?: "left" | "right" | "middle"
  /** Unsupported: one click is dispatched. */
  clickCount?: number
  /** Unsupported: no modifier is held. */
  modifiers?: string[]
  /** Unsupported: the element center is the click target. */
  position?: { x: number; y: number }
  /** Unsupported: pointer movement is a single step. */
  steps?: number
}
export type ClickOptions = ActionOptions & {
  /** Required for a control whose label or type marks it as a submission. */
  allowSubmit?: boolean
}

export interface LocatorControls {
  query: LocatorQuery
  getByRole(role: string, options?: { name?: string; exact?: boolean }): LocatorControls
  filter(options: { has?: LocatorControls; visible?: boolean }): LocatorControls
  first(): LocatorControls
  last(): LocatorControls
  nth(index: number): LocatorControls
  count(options?: TimeoutOptions): Promise<number>
  isVisible(options?: TimeoutOptions): Promise<boolean>
  isEnabled(options?: TimeoutOptions): Promise<boolean>
  isChecked(options?: TimeoutOptions): Promise<boolean>
  inputValue(options?: TimeoutOptions): Promise<string>
  textContent(options?: TimeoutOptions): Promise<string | null>
  getAttribute(name: string, options?: TimeoutOptions): Promise<string | null>
  allTextContents(): Promise<string[]>
  click(options?: ClickOptions): Promise<void>
  fill(value: string, options?: ActionOptions): Promise<void>
  selectOption(value: { label: string }, options?: ActionOptions): Promise<void>
  press(value: string, options?: ActionOptions): Promise<void>
  hover(options?: ActionOptions): Promise<void>
  waitFor(options?: { state?: "attached" | "detached" | "hidden" | "visible"; timeout?: number }): Promise<void>
}
export interface PageControls {
  url(): string
  isClosed(): boolean
  getByRole(role: string, options?: { name?: string; exact?: boolean }): LocatorControls
  getByPlaceholder(value: string, options?: { exact?: boolean }): LocatorControls
  getByLabel(value: string, options?: { exact?: boolean }): LocatorControls
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
  installSelectorEngine(source: string, options?: { frameId?: number }): Promise<EngineInstall>
  resolveSelector(selector: string, options?: { strict?: boolean; frameId?: number }): Promise<EngineResult>
  /** Runs a function expression in the page's own realm and returns its resolved, serializable value. */
  evaluate<R = unknown>(source: string, args?: unknown[]): Promise<R>
  readStorage(kind: "localStorage" | "sessionStorage", key: string): Promise<string | null>
  snapshotStorage(kind: "localStorage" | "sessionStorage"): Promise<Record<string, string>>
  /** Rasterizes in the page realm: full page and element clips work without a compositor capture. */
  screenshot(options?: ScreenshotOptions): Promise<ImageAsset>
}
export interface ExtensionCommands {
  tabs(): Promise<TabInfo[]>
  execute(tabId: number, command: DomCommand): Promise<unknown>
  open(url: string): Promise<TabInfo>
  navigate(tabId: number, url: string): Promise<void>
  activate(tabId: number): Promise<void>
  installSelectorEngine(tabId: number, source: string, frameId?: number): Promise<EngineInstall>
  resolveWithSelectorEngine(tabId: number, query: EngineQuery): Promise<EngineResult>
  evaluateInPage(tabId: number, source: string, args?: unknown[]): Promise<unknown>
  capturePage(tabId: number, options: ScreenshotOptions): Promise<ImageAsset>
}
/** Playwright selector query handed to the injected engine in the page realm. */
export type EngineQuery = { selector: string; strict?: boolean; frameId?: number }
/** Matched elements are tagged `data-bewpp-hit="<marker>-<index>"` so content-script actions can address them. */
export type EngineResult = { count: number; marker: string; installed: boolean }
export type EngineInstall = { installed: boolean }
export type ScreenshotOptions = { fullPage?: boolean; selector?: string; format?: "png" | "jpeg" }
export interface BridgeEvents {
  changed(tabs: TabInfo[]): void
  ping(): void
}
