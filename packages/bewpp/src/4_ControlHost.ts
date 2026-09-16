import { timingSafeEqual } from "node:crypto"
import { E_ALREADY_LOCKED, Mutex, tryAcquire } from "async-mutex"
import type { FastifyInstance } from "fastify"
import { browserCommandSchema } from "./0_commands.js"
import type { ExtensionConnection } from "./2_Connection.js"

/** One host per extension connection. App actions and MCP commands share its mutex. */
export class BrowserControlHost {
  mutex = new Mutex()
  connection: ExtensionConnection
  busy: () => boolean
  constructor(connection: ExtensionConnection, busy = () => false) {
    this.connection = connection
    this.busy = busy
  }

  async run<T>(action: () => Promise<T> | T, { allowReserved = false } = {}): Promise<T> {
    try {
      return await tryAcquire(this.mutex).runExclusive(() => {
        if (!allowReserved && this.busy())
          throw Object.assign(new Error("Browser is reserved by an application job."), { statusCode: 409 })
        return action()
      })
    } catch (error) {
      if (error === E_ALREADY_LOCKED)
        throw Object.assign(new Error("Another browser command is running. Inspect state before retrying."), {
          statusCode: 409,
        })
      throw error
    }
  }

  async execute(raw: unknown): Promise<unknown> {
    const command = browserCommandSchema.parse(raw)
    const connection = this.connection
    if (command.op === "status" || command.op === "tabs") {
      await connection.refreshTabs()
      return {
        ...connection.status(),
        busy: this.busy() || this.mutex.isLocked(),
        ...(command.op === "tabs" ? { tabs: connection.enabled ? connection.tabs : [] } : {}),
      }
    }
    return this.run(async () => {
      await connection.refreshTabs()
      if (connection.error) throw new Error(connection.error)
      const page = connection.getPage(command.tabId)
      if (!page) throw new Error("Tab unavailable. Call tabs_list and use a permitted tab ID.")
      if (command.op === "navigate") {
        await page.goto(command.url)
        return { navigated: true }
      }
      if (command.op === "activate") {
        await page.bringToFront()
        return { activated: true }
      }
      // Page-level operations are not DOM commands: they run in the page realm, not the content script.
      if (command.op === "evaluate") return page.evaluate(command.source, command.args)
      if (command.op === "storage")
        return command.key == null ? page.snapshotStorage(command.kind) : page.readStorage(command.kind, command.key)
      if (command.op === "screenshot")
        return page.screenshot({ fullPage: command.fullPage, selector: command.selector, format: command.format })
      const { tabId, ...dom } = command
      // Use the content-script download path, which verifies the image is on this tab.
      return (await page.rpc.execute(tabId, dom)) ?? null
    })
  }
}

export function registerBrowserControl(
  app: FastifyInstance,
  { host, token }: { host: BrowserControlHost; token: string },
) {
  const expected = Buffer.from(`Bearer ${token}`)
  app.post(
    "/bewpp/command",
    {
      // The selector engine is delivered through this endpoint, so the body limit covers a full bundle.
      bodyLimit: 4 * 1024 * 1024,
      onRequest: async (request, reply) => {
        const provided = Buffer.from(request.headers.authorization ?? "")
        const hostname = new URL(`http://${request.headers.host}`).hostname
        if (
          !["127.0.0.1", "localhost", "[::1]"].includes(hostname) ||
          request.headers.origin ||
          provided.length !== expected.length ||
          !timingSafeEqual(provided, expected)
        ) {
          return reply.code(403).send({ error: "Authorized local bewpp clients only." })
        }
      },
    },
    async (request, reply) => {
      try {
        return { result: await host.execute(request.body) }
      } catch (error) {
        return reply
          .code((error as { statusCode?: number }).statusCode ?? 400)
          .send({ error: String((error as Error).message ?? error) })
      }
    },
  )
}
