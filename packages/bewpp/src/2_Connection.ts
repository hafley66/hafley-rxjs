import { type BirpcReturn, createBirpc } from "birpc"
import type { WebSocket } from "ws"
import type { BridgeEvents, ExtensionCommands, TabInfo } from "./0_controls.js"
import { rpcEncoding } from "./0_rpc.js"
import { ExtensionPage } from "./1_Page.js"

export class ExtensionConnection {
  socket: WebSocket | null = null
  rpc: BirpcReturn<ExtensionCommands, BridgeEvents> | null = null
  tabs: TabInfo[] = []
  page: ExtensionPage | null = null
  enabled = true
  error: string | null = null
  refreshing: Promise<void> | null = null
  tabsVersion = 0
  acceptsPage = (_url: string) => true

  attach(socket: WebSocket) {
    this.socket?.close(1000, "Connection replaced")
    this.socket = socket
    this.tabs = []
    this.page = null
    this.error = null
    const peer = createBirpc<ExtensionCommands, BridgeEvents>(
      {
        changed: tabs => {
          if (this.socket === socket) {
            this.tabs = tabs
            this.tabsVersion++
          }
        },
        ping() {},
      },
      {
        post: data => socket.send(data),
        on: handler => socket.on("message", data => handler(data.toString())),
        ...rpcEncoding,
        timeout: 45_000,
      },
    )
    this.rpc = peer
    socket.once("close", () => {
      peer.$close()
      if (this.socket === socket) {
        this.socket = null
        this.rpc = null
        this.tabs = []
        this.page = null
      }
    })
  }
  connect() {
    this.enabled = true
    this.error = this.socket ? null : "Load the local bewpp extension to connect."
  }
  async refreshTabs() {
    if (!this.enabled || !this.rpc) return
    if (this.refreshing) return this.refreshing
    const peer = this.rpc
    const version = this.tabsVersion
    const refresh = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const tabs = await Promise.race([
          peer.tabs(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("Extension tab discovery timed out.")), 2000)
          }),
        ])
        if (this.rpc === peer) {
          if (this.tabsVersion === version) this.tabs = tabs
          this.error = null
        }
      } catch (error) {
        if (this.rpc === peer) this.error = String((error as Error).message ?? error)
      } finally {
        clearTimeout(timer)
      }
    })()
    this.refreshing = refresh
    try {
      await refresh
    } finally {
      if (this.refreshing === refresh) this.refreshing = null
    }
  }
  async openPage(url: string) {
    if (!this.enabled || !this.rpc) throw new Error("Connect the browser extension first.")
    const tab = await this.rpc.open(url)
    this.tabs = [...this.tabs.filter(existing => existing.id !== tab.id), tab]
    this.page = new ExtensionPage(tab.id, this.rpc, () => this.tabs)
    await this.page.waitForURL(new RegExp(`^${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[?#]|$)`), {
      timeout: 15_000,
    })
    return this.page
  }
  getPage(tabId?: number) {
    if (!this.enabled || !this.rpc) return null
    if (tabId != null)
      return this.tabs.some(tab => tab.id === tabId) ? new ExtensionPage(tabId, this.rpc, () => this.tabs) : null
    if (this.page && !this.page.isClosed() && this.acceptsPage(this.page.url())) return this.page
    const tab = this.tabs.find(tab => this.acceptsPage(tab.url))
    this.page = tab ? new ExtensionPage(tab.id, this.rpc, () => this.tabs) : null
    return this.page
  }
  status() {
    const page = this.getPage()
    return {
      connected: this.enabled && !!this.socket,
      connecting: false,
      page_ready: !!page,
      url: page?.url() ?? null,
      error: this.error,
    }
  }
  async disconnect() {
    this.enabled = false
    this.page = null
  }
  async shutdown() {
    this.socket?.close(1000, "Bridge shutdown")
    this.rpc?.$close()
    this.socket = null
    this.rpc = null
    this.tabs = []
    this.page = null
  }
}
