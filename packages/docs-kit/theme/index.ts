// The VitePress theme every site in this workspace extends. A site names its demo registry, its
// stats, the components its own pages use, and nothing else.
import DefaultTheme from "vitepress/theme"
import { h, type Component, type VNode } from "vue"
import type { Theme } from "vitepress"
import { useMeterLog, type MeterLog } from "../src/3_meters.ts"
import { CORE_SECTIONS, type SectionBuilder, type Stats } from "../src/5_stats.ts"
import { useDemos, useReceipts, type DemoHost } from "./0_site.ts"
import "./docs.css"
import Demo from "./Demo.vue"
import FpsMeter from "./FpsMeter.vue"
import ReceiptsFooter from "./ReceiptsFooter.vue"
import ReceiptsSection from "./ReceiptsSection.vue"

export { Demo, FpsMeter, ReceiptsFooter, ReceiptsSection }
export { sinkOf, fps, mountedDemos, retainMeters, type LogSink, type MeterLog, type Timing } from "../src/3_meters.ts"
export { useDemos, useReceipts, demoHost, receiptsHost, type DemoHost, type ReceiptsHost } from "./0_site.ts"

export interface DocsThemeOptions {
  readonly demos: DemoHost
  readonly stats: Stats
  /** Merged over the kit's own sections, so a package can add one and override none. */
  readonly sections?: Readonly<Record<string, SectionBuilder>>
  /** The sink whose structured records feed the timing strip. Absent leaves the strip blank. */
  readonly log?: MeterLog
  /** The name a site's markdown spells the demo panel with. */
  readonly demoComponent: string
  /** Registered globally beside the panel, for pages only this site has. */
  readonly components?: Readonly<Record<string, Component>>
  /** Rendered into the `doc-after` slot, for a site that mounts something under every document. */
  readonly docAfter?: () => VNode | readonly VNode[]
}

export function docsTheme(options: DocsThemeOptions): Theme {
  useDemos(options.demos)
  useReceipts({ stats: options.stats, sections: { ...CORE_SECTIONS, ...options.sections } })
  if (options.log !== undefined) useMeterLog(options.log)

  return {
    extends: DefaultTheme,
    Layout: () =>
      h(DefaultTheme.Layout, null, {
        ...(options.docAfter === undefined ? {} : { "doc-after": options.docAfter }),
        "layout-bottom": () => [h(ReceiptsFooter), h(FpsMeter)],
      }),
    enhanceApp({ app }) {
      app.component("ReceiptsSection", ReceiptsSection)
      app.component(options.demoComponent, Demo)
      for (const [name, component] of Object.entries(options.components ?? {})) app.component(name, component)
    },
  }
}
