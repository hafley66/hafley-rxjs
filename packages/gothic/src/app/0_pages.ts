import type { FC } from "react"
import type { AnySpec } from "../kit/0_spec.js"
import { queryRoute } from "../kit/1_url.js"
import { PAGE as arches } from "../pages/7_arches.js"
import { PAGE as border } from "../pages/3_border.js"
import { PAGE as circles } from "../pages/5_circles.js"
import { PAGE as eye } from "../pages/0_eye.js"
import { PAGE as fractal } from "../pages/4_fractal.js"
import { PAGE as frames } from "../pages/8_frames.js"
import { PAGE as icons } from "../pages/2_icons.js"
import { PAGE as slice } from "../pages/1_slice.js"
import { PAGE as tiles } from "../pages/6_tiles.js"

// specs = the sections that own url namespaces; anchors = extra sections that render without a bar
export type PageSpec = {
  id: string
  title: string
  path: string
  specs: Record<string, AnySpec>
  anchors?: readonly string[]
  Component: FC
}
export type PageDef = PageSpec & { sections: readonly string[]; route: ReturnType<typeof queryRoute> }

const define = (p: PageSpec): PageDef => ({
  ...p,
  sections: [...Object.keys(p.specs), ...(p.anchors ?? [])],
  route: queryRoute(p.specs, p.path),
})

export const PAGES: readonly PageDef[] = [eye, slice, icons, border, fractal, circles, tiles, arches, frames].map(
  define,
)

export const matchPage = (path: string): PageDef => PAGES.find(p => p.route.match(path).matched) ?? PAGES[0]
