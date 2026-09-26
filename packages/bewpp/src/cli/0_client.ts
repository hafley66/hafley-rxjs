import type { BrowserCommand } from "../0_commands.js"

/** Copied from bewpp-mcp/src/0_client.ts: same loopback guard, same no-retry comment, verbatim. */
export class BridgeClient {
  url: URL
  token: string
  constructor({ url, token }: { url: string; token: string }) {
    this.url = new URL(url)
    if (this.url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(this.url.hostname)
      || this.url.username || this.url.password || this.url.pathname !== "/" || this.url.search || this.url.hash) throw new Error("Use a loopback HTTP bridge origin.")
    if (!token.trim()) throw new Error("A bridge pairing token is required.")
    this.token = token.trim()
  }
  async call(command: BrowserCommand, signal?: AbortSignal): Promise<unknown> {
    // No retry: an interrupted response can follow an already executed click.
    const response = await fetch(new URL("/bewpp/command", this.url), {
      method: "POST", headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify(command), redirect: "error",
      signal: AbortSignal.any([AbortSignal.timeout(50_000), ...(signal ? [signal] : [])]),
    })
    const payload = await response.json() as { error?: string; result?: unknown }
    if (!response.ok) throw new Error(payload.error ?? `Bridge command failed (${response.status}).`)
    return payload.result
  }
}
