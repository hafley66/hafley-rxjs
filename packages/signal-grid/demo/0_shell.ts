// A route names the parity features it exercises by `FeatureId`, so a rename in `src/features.ts`
// is a compile error rather than a paragraph that quietly stopped being true.
import { FEATURES, type FeatureId } from "../src/features.js"
import { h } from "./controls.js"

declare global {
  interface Window {
    /** The grid the active route mounted. */
    __grid: unknown
    /** Whatever the active route wanted reachable from the console. */
    __demo: Record<string, unknown>
  }
}

/** The four boxes `index.html` owns. A route fills them and empties them again on teardown. */
export interface DemoHosts {
  readonly shell: HTMLElement
  readonly panel: HTMLElement
  readonly stage: HTMLElement
  readonly readout: HTMLElement
}

export interface DemoHandle {
  /** Published as `window.__grid`. Typed loose because each route holds a different row type. */
  readonly grid: unknown
  readonly stop: () => void
}

export interface DemoRoute {
  /** The url segment. `/tree` is `slug: "tree"`. */
  readonly slug: string
  readonly title: string
  readonly blurb: string
  /** One line: what this route is trying to break. */
  readonly stressing: string
  readonly features: readonly FeatureId[]
  /** Defects this route found, each already reproduced. Rendered under the feature list. */
  readonly defects: readonly string[]
  readonly mount: (hosts: DemoHosts) => DemoHandle
}

/** The card at the top of every control panel. Same shape on all four routes. */
export function aboutPanel(route: DemoRoute): HTMLElement {
  const el = h("section", "group about")
  el.append(h("h2", "group-title", "stressing"))
  el.append(h("p", "about-line", route.stressing))
  const list = h("ul", "about-features")
  for (const id of route.features) {
    const meta = FEATURES[id]
    const item = h("li", "about-feature")
    item.append(h("code", "about-id", meta.id), h("span", "about-title", meta.title))
    list.append(item)
  }
  el.append(h("h2", "group-title", `parity features (${route.features.length})`), list)
  if (route.defects.length > 0) {
    el.append(h("h2", "group-title", `defects found (${route.defects.length})`))
    const found = h("ul", "about-defects")
    for (const line of route.defects) found.append(h("li", "about-defect", line))
    el.append(found)
  }
  return el
}

/** A host the route owns entirely, so teardown is one `remove()` whatever the route built. */
export function stageBox(hosts: DemoHosts, className: string): HTMLElement {
  const box = h("div", className)
  box.id = "mount"
  hosts.stage.append(box)
  return box
}
