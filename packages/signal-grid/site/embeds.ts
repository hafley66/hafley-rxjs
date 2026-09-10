// The hand-off point for live demos.
//
// After a page renders, the site calls the entry keyed by that page's slug with the content
// element and expects a teardown back. Nothing here mounts anything yet: a lane that wants a live
// grid under the Demo page adds one entry, mounts into the marked host, and returns its own stop
// function. Everything else on the page keeps working when a mount throws, because the caller
// catches it and reports the failure inline.
export type Embed = (content: HTMLElement) => (() => void) | void

export const EMBEDS: Readonly<Record<string, Embed | undefined>> = {}

/**
 * Where an embed is meant to land: the first element carrying `data-embed`, or the end of the page
 * when the markdown declares none.
 */
export function embedHost(content: HTMLElement): HTMLElement {
  const marked = content.querySelector("[data-embed]")
  if (marked instanceof HTMLElement) return marked
  const host = document.createElement("div")
  host.dataset.embed = ""
  content.append(host)
  return host
}
