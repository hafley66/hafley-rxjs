import { type BirpcReturn, createBirpc } from "birpc"
import type { BridgeEvents, DomCommand, ExtensionCommands, TabInfo } from "../0_controls.js"
import { rpcEncoding } from "../0_rpc.js"
import { onMessage, sendMessage } from "./0_messaging.js"

declare const __BEWPP_TOKEN__: string
declare const __BEWPP_URL__: string
declare const __BEWPP_MATCHES__: string[]

let socket: WebSocket | null = null
let rpc: BirpcReturn<BridgeEvents, ExtensionCommands> | null = null
const readyTabs = new Set<number>()

async function tabs(): Promise<TabInfo[]> {
  return (await chrome.tabs.query({ url: __BEWPP_MATCHES__ }))
    .filter(tab => tab.id != null && !!tab.url)
    .sort((a, b) => Number(b.active) - Number(a.active) || (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
    .map(tab => ({ id: tab.id!, url: tab.url!, title: tab.title ?? "", active: tab.active }))
}
async function publishTabs() {
  if (rpc && socket?.readyState === WebSocket.OPEN) await rpc.changed(await tabs()).catch(() => {})
}
async function waitForComplete(tabId: number): Promise<void> {
  if ((await chrome.tabs.get(tabId)).status === "complete") return
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timeout)
      chrome.tabs.onUpdated.removeListener(updated)
      error ? reject(error) : resolve()
    }
    const updated = (id: number, change: chrome.tabs.OnUpdatedInfo) => {
      if (id === tabId && change.status === "complete") finish()
    }
    const timeout = setTimeout(() => finish(new Error("The browser tab did not finish loading.")), 15_000)
    chrome.tabs.onUpdated.addListener(updated)
    void chrome.tabs.get(tabId).then(
      tab => {
        if (tab.status === "complete") finish()
      },
      error => finish(error),
    )
  })
}
/** Serialized into the page realm by `chrome.scripting.executeScript`; must stay self-contained. */
const ENGINE_INSTALLER = (engineSource: string) => {
  const state = globalThis as typeof globalThis & { __bewppEngine?: unknown; __bewppEngineClass?: unknown }
  if (state.__bewppEngine) return { installed: false }
  const module = { exports: {} as Record<string, unknown> }
  new Function("module", "exports", `${engineSource}\n;globalThis.__bewppEngineClass = InjectedScript;`)(
    module,
    module.exports,
  )
  const InjectedScript = state.__bewppEngineClass as new (
    window: Window,
    options: Record<string, unknown>,
  ) => {
    parseSelector: (selector: string) => unknown
    querySelector: (parsed: unknown, root: Node, strict: boolean) => Element
    querySelectorAll: (parsed: unknown, root: Node) => Element[]
  }
  const injected = new InjectedScript(window, {
    isUnderTest: false,
    sdkLanguage: "javascript",
    frameSeq: 0,
    testIdAttributeName: "data-testid",
    stableRafCount: 1,
    browserName: "chromium",
    isUtilityWorld: false,
    customEngines: [],
  })
  let sequence = 0
  state.__bewppEngine = {
    query(selector: string, strict: boolean) {
      const parsed = injected.parseSelector(selector)
      const elements = strict
        ? [injected.querySelector(parsed, document, true)]
        : injected.querySelectorAll(parsed, document)
      const marker = `b${++sequence}`
      for (const [index, element] of elements.entries()) element.setAttribute("data-bewpp-hit", `${marker}-${index}`)
      return { count: elements.length, marker }
    },
  }
  return { installed: true }
}
/** Serialized into the page realm; keeps the engine's own error text (strict-mode violations included) intact. */
const ENGINE_QUERY = (selector: string, strict: boolean) => {
  const state = globalThis as typeof globalThis & {
    __bewppEngine?: { query: (selector: string, strict: boolean) => unknown }
  }
  if (!state.__bewppEngine)
    return { ok: false, error: "Install the selector engine before resolving Playwright selectors." }
  try {
    return { ok: true, value: state.__bewppEngine.query(selector, strict) }
  } catch (error) {
    return { ok: false, error: String((error as Error)?.message ?? error) }
  }
}
/** Engine state lives in a document, so a navigation drops it. Remember the source and reinstate it. */
const engineSources = new Map<number, { source: string; frameId?: number }>()
async function injectEngine(tabId: number, source: string, frameId?: number): Promise<{ installed: boolean }> {
  const [result] = await chrome.scripting.executeScript({
    target: frameId == null ? { tabId } : { tabId, frameIds: [frameId] },
    world: "MAIN",
    func: ENGINE_INSTALLER,
    args: [source],
  })
  return (result?.result as { installed: boolean } | undefined) ?? { installed: false }
}
async function execute(tabId: number, command: DomCommand): Promise<unknown> {
  if (!(await tabs()).some(tab => tab.id === tabId)) throw new Error("Tab is outside the extension’s permitted sites.")
  await waitForComplete(tabId)
  if (!readyTabs.has(tabId)) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["page-hooks.js"], world: "MAIN" })
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] })
    readyTabs.add(tabId)
  }
  return sendMessage("dom", command, { tabId, frameId: 0 })
}

function connect() {
  if (socket && socket.readyState !== WebSocket.CLOSED) return
  const ws = new WebSocket(__BEWPP_URL__, `bewpp-${__BEWPP_TOKEN__}`)
  socket = ws
  const functions: ExtensionCommands = {
    tabs,
    execute,
    async open(url) {
      const parsed = new URL(url)
      if (
        !["https:", "http:"].includes(parsed.protocol) ||
        !(await chrome.permissions.contains({ origins: [`${parsed.origin}/*`] }))
      )
        throw new Error("Opening a tab requires site permission.")
      const tab = await chrome.tabs.create({ url, active: false })
      if (tab.id == null) throw new Error("Could not open the browser tab.")
      return { id: tab.id, url, title: tab.title ?? "", active: false }
    },
    async navigate(tabId, url) {
      const parsed = new URL(url)
      if (
        !["https:", "http:"].includes(parsed.protocol) ||
        !(await chrome.permissions.contains({ origins: [`${parsed.origin}/*`] }))
      )
        throw new Error("Navigation requires site permission.")
      if (!(await tabs()).some(tab => tab.id === tabId)) throw new Error("Tab is unavailable.")
      await chrome.tabs.update(tabId, { url })
    },
    async activate(tabId) {
      if (!(await tabs()).some(tab => tab.id === tabId)) throw new Error("Tab is unavailable.")
      const tab = await chrome.tabs.update(tabId, { active: true })
      if (!tab) throw new Error("Tab is unavailable.")
      await chrome.windows.update(tab.windowId, { focused: true })
    },
    async installSelectorEngine(tabId, source, frameId) {
      if (!(await tabs()).some(tab => tab.id === tabId))
        throw new Error("Tab is outside the extension’s permitted sites.")
      await waitForComplete(tabId)
      const result = await injectEngine(tabId, source, frameId)
      engineSources.set(tabId, { source, frameId })
      return result
    },
    async resolveWithSelectorEngine(tabId, query) {
      if (!(await tabs()).some(tab => tab.id === tabId))
        throw new Error("Tab is outside the extension’s permitted sites.")
      await waitForComplete(tabId)
      const [result] = await chrome.scripting.executeScript({
        target: query.frameId == null ? { tabId } : { tabId, frameIds: [query.frameId] },
        world: "MAIN",
        func: ENGINE_QUERY,
        args: [query.selector, query.strict ?? false],
      })
      const payload = result?.result as
        | { ok: boolean; value?: { count: number; marker: string }; error?: string }
        | undefined
      if (!payload) throw new Error("The page realm returned no engine result.")
      if (!payload.ok) throw new Error(payload.error)
      return payload.value as { count: number; marker: string }
    },
  }
  const peer = createBirpc<BridgeEvents, ExtensionCommands>(functions, {
    post: data => ws.send(data),
    on: handler => {
      ws.onmessage = event => handler(event.data)
    },
    ...rpcEncoding,
    timeout: 45_000,
  })
  let heartbeat: ReturnType<typeof setInterval> | undefined
  ws.onopen = () => {
    rpc = peer
    void publishTabs()
    // Chrome 116+ keeps an extension worker alive while WebSocket messages flow.
    heartbeat = setInterval(() => {
      void peer.ping().catch(() => ws.close())
      void publishTabs()
    }, 20_000)
  }
  ws.onclose = () => {
    clearInterval(heartbeat)
    peer.$close()
    if (socket === ws) {
      socket = null
      rpc = null
    }
    setTimeout(connect, 2000)
  }
  ws.onerror = () => ws.close()
}

onMessage("ready", ({ sender }) => {
  if (sender.tab?.id != null) readyTabs.add(sender.tab.id)
  void publishTabs()
})
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === "loading") readyTabs.delete(tabId)
  if (change.status === "complete") {
    const remembered = engineSources.get(tabId)
    if (remembered) void injectEngine(tabId, remembered.source, remembered.frameId).catch(() => {})
  }
  if (change.url || change.status === "complete") void publishTabs()
})
chrome.tabs.onRemoved.addListener(tabId => {
  readyTabs.delete(tabId)
  void publishTabs()
})
chrome.tabs.onActivated.addListener(() => {
  void publishTabs()
})
chrome.runtime.onStartup.addListener(connect)
chrome.runtime.onInstalled.addListener(connect)
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "bewpp-connect") connect()
})
void chrome.alarms.create("bewpp-connect", { periodInMinutes: 0.5 })
connect()
