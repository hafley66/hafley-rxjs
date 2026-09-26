import { type BirpcReturn, createBirpc } from "birpc"
import type { BridgeEvents, DomCommand, EngineResult, ExtensionCommands, TabInfo } from "../0_controls.js"
import { rpcEncoding } from "../0_rpc.js"
import { onMessage, sendMessage } from "./0_messaging.js"

declare const __BEWPP_TOKEN__: string
declare const __BEWPP_URL__: string
declare const __BEWPP_MATCHES__: string[]
declare const __BEWPP_EXCLUDES__: string[]

let socket: WebSocket | null = null
let rpc: BirpcReturn<BridgeEvents, ExtensionCommands> | null = null
const readyTabs = new Set<number>()
const CONTROL_SELECTOR =
  'a[href], button, input, textarea, select, [role="button"], [role="combobox"], [role="menuitem"], [role="option"], [contenteditable="true"]'


async function tabs(): Promise<TabInfo[]> {
  // Chrome's own pattern matcher decides the exclusions; tabs.query has no negation.
  const excluded = new Set(
    __BEWPP_EXCLUDES__.length ? (await chrome.tabs.query({ url: __BEWPP_EXCLUDES__ })).map(tab => tab.id) : [],
  )
  return (await chrome.tabs.query({ url: __BEWPP_MATCHES__ }))
    .filter(tab => tab.id != null && !!tab.url && !excluded.has(tab.id))
    .sort((a, b) => Number(b.active) - Number(a.active) || (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
    .map(tab => ({ id: tab.id!, url: tab.url!, title: tab.title ?? "", active: tab.active }))
}
async function publishTabs() {
  if (rpc && socket?.readyState === WebSocket.OPEN) await rpc.changed(await tabs()).catch(() => {})
}
async function preserveActiveTabs<T>(action: () => Promise<T>): Promise<T> {
  const active = (await chrome.tabs.query({ active: true }))
    .filter(tab => tab.id != null)
    .map(tab => tab.id!)
  try {
    return await action()
  } finally {
    await Promise.all(active.map(id => chrome.tabs.update(id, { active: true }).catch(() => undefined)))
  }
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

async function execute(tabId: number, command: DomCommand): Promise<unknown> {
  if (!(await tabs()).some(tab => tab.id === tabId)) throw new Error("Tab is outside the extension’s permitted sites.")
  return preserveActiveTabs(async () => {
    await waitForComplete(tabId)
    if (!readyTabs.has(tabId)) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["page-hooks.js"], world: "MAIN" })
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] })
      readyTabs.add(tabId)
    }
    const result = await sendMessage("dom", command, { tabId, frameId: 0 })
    if (
      command.op === "query" &&
      command.action === "click" &&
      result &&
      typeof result === "object" &&
      "openInBackground" in result &&
      typeof result.openInBackground === "string"
    ) {
      const tab = await chrome.tabs.create({ url: result.openInBackground, active: false })
      return { openedTabId: tab.id, url: result.openInBackground }
    }
    return result
  })
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
      await preserveActiveTabs(() => chrome.tabs.update(tabId, { url }).then(() => undefined))
    },
    async activate(tabId) {
      if (!(await tabs()).some(tab => tab.id === tabId)) throw new Error("Tab is unavailable.")
      const tab = await chrome.tabs.update(tabId, { active: true })
      if (!tab) throw new Error("Tab is unavailable.")
      await chrome.windows.update(tab.windowId, { focused: true })
    },
    async capturePage(tabId, options) {
      if (!(await tabs()).some(tab => tab.id === tabId))
        throw new Error("Tab is outside the extension’s permitted sites.")
      await waitForComplete(tabId)
      // A real file resource, not a string handed to `new Function`: Trusted Types gates the
      // latter, not a script the extension loads via files.
      await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", files: ["screenshot.js"] })
      // The deadline lives here, not in the page: a hidden tab clamps its own timers, so an
      // in-page setTimeout can outlast the caller it was meant to protect.
      const deadline = Math.max(1000, Number(options?.timeoutMs) || 25000)
      const [result] = (await Promise.race([
        chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: async (settings: { fullPage?: boolean; selector?: string; format?: string; timeoutMs?: number }) => {
          // A DOM Event carries no .message; String(event) collapses it to "[object Event]".
          // Read .type and, for a failed image load, the element and its src length instead.
          const describeError = (error: unknown): string => {
            if (error instanceof Event) {
              const target = error.target as (EventTarget & { tagName?: string; src?: string }) | null
              const tag = target?.tagName ?? "unknown element"
              const src = typeof target?.src === "string" ? target.src : undefined
              return src != null
                ? `${error.type} event on <${tag}> loading src of length ${src.length}`
                : `${error.type} event on <${tag}>`
            }
            if (error instanceof Error) return error.message
            try {
              return JSON.stringify(error) ?? String(error)
            } catch {
              return String(error)
            }
          }
          let image: HTMLImageElement | undefined
          let canvas: HTMLCanvasElement | undefined
          try {
            const library = (globalThis as typeof globalThis & { __bewppShot?: Record<string, unknown> })
              .__bewppShot as
              | Record<string, (node: Element, options: Record<string, unknown>) => Promise<string>>
              | undefined
            if (!library) return { ok: false, error: "Screenshot library did not install." }
            const node = settings.selector ? document.querySelector(settings.selector) : document.documentElement
            if (!node) return { ok: false, error: "Screenshot selector did not match." }
            // cacheBust appends a query param to every image URL, forcing a refetch of each one
            // during embedding, which is what pushes an image-heavy page past the caller's deadline.
            const common = { pixelRatio: 1, skipFonts: true }
            const options = settings.fullPage
              ? { ...common, width: node.scrollWidth, height: node.scrollHeight, backgroundColor: "#ffffff" }
              : common
            // toCanvas waits on img.onload behind a setTimeout, and a hidden tab clamps that timer.
            // decode() is a promise off the timer queue, so serialize to SVG and rasterize here.
            const svg = (await (library.domToSvg ?? library.toSvg)(node, options)) as string
            image = new Image()
            image.src = svg
            await image.decode()
            canvas = document.createElement("canvas")
            canvas.width = image.naturalWidth
            canvas.height = image.naturalHeight
            const context = canvas.getContext("2d")
            if (!context) return { ok: false, error: "The page realm refused a 2d canvas context." }
            context.drawImage(image, 0, 0)
            return { ok: true, dataUrl: canvas.toDataURL(settings.format === "jpeg" ? "image/jpeg" : "image/png") }
          } catch (error) {
            return { ok: false, error: describeError(error) }
          } finally {
            if (image) image.src = ""
            if (canvas) {
              canvas.width = 0
              canvas.height = 0
            }
          }
        },
        args: [options ?? {}],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Serializing the page exceeded ${deadline}ms. Narrow it with a selector.`)),
            deadline,
          ),
        ),
      ])) as chrome.scripting.InjectionResult<unknown>[]
      const payload = result?.result as { ok: boolean; dataUrl?: string; error?: string } | undefined
      if (!payload) throw new Error("The page realm returned no screenshot.")
      if (!payload.ok) throw new Error(payload.error)
      const [meta, base64] = String(payload.dataUrl).split(",")
      const mime = meta.slice(meta.indexOf(":") + 1, meta.indexOf(";"))
      return { mime, base64 }
    },
    async describeControl(tabId, index) {
      if (!(await tabs()).some(tab => tab.id === tabId))
        throw new Error("Tab is outside the extension\u2019s permitted sites.")
      await waitForComplete(tabId)
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector: string, target: number) => {
          const visible = (element: Element) =>
            !!element.getClientRects().length &&
            getComputedStyle(element).visibility !== "hidden" &&
            !element.closest("[hidden], [inert]")
          const element = [...document.querySelectorAll(selector)].filter(visible)[target]
          if (!element) return null
          const ancestry: { tag: string; role: string | null; name: string | null; id: string | null }[] = []
          let node: Element | null = element
          while (node) {
            ancestry.push({
              tag: node.tagName,
              role: node.getAttribute("role"),
              name: node.getAttribute("aria-label"),
              id: node.id || null,
            })
            node = node.parentElement
          }
          const parts: string[] = []
          let current: Element | null = element
          while (current && current !== document.body) {
            if (current.id) {
              parts.unshift(`#${current.id}`)
              break
            }
            const parent: Element | null = current.parentElement
            const twins = parent ? [...parent.children].filter(child => child.tagName === current!.tagName) : [current]
            const nth = twins.indexOf(current) + 1
            parts.unshift(current.tagName.toLowerCase() + (twins.length > 1 ? `:nth-of-type(${nth})` : ""))
            current = parent
          }
          return { selectorPath: parts.join(" > "), ancestry }
        },
        args: [CONTROL_SELECTOR, index],
      })
      return (result?.result as unknown) ?? null
    },
    async resolveWithSelectorEngine(tabId, query) {
      return (await execute(tabId, { op: "resolve", selector: query.selector, strict: query.strict })) as EngineResult
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
