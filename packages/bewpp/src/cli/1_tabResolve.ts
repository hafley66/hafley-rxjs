import type { BridgeClient } from "./0_client.js"
import { type TabArg, classifyTabArg } from "./0_tab.js"

export type TabInfo = { id: number; url: string; title: string; active: boolean }

export async function listTabs(client: BridgeClient): Promise<TabInfo[]> {
  const result = (await client.call({ op: "tabs" } as never)) as { tabs: TabInfo[] }
  return result.tabs
}

export async function resolveTabId(client: BridgeClient, arg: TabArg, cachedTabs?: TabInfo[]): Promise<{ tabId: number; tabs: TabInfo[] }> {
  if (arg.kind === "id") return { tabId: Number(arg.id), tabs: cachedTabs ?? [] }
  const tabs = cachedTabs ?? (await listTabs(client))
  const active = tabs.filter(tab => tab.active)
  if (active.length !== 1) throw new Error(`expected exactly one active tab, found ${active.length}`)
  return { tabId: active[0]!.id, tabs }
}

/** Splits a leading tab argument that only ever looks like a tab id or a tab sentinel from the command's own args. */
export function splitOptionalTab(positionals: string[]): { tabArg: TabArg; rest: string[] } {
  try {
    return { tabArg: classifyTabArg(positionals[0]), rest: positionals.slice(1) }
  } catch {
    return { tabArg: { kind: "active" }, rest: positionals }
  }
}
