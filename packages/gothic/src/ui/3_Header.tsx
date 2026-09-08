import { NavTabs } from "@hafley66/report-shell"
import type { ReactNode } from "react"
import type { PageDef } from "../app/0_pages.js"
import { hashMode, navigate, toHref } from "../app/1_router.js"

type Props = { pages: readonly PageDef[]; current: PageDef; end?: ReactNode }

// the kit tab row over gothic's pages: tabs = files, anchors = the current page's sections, end = page knobs
export function Header({ pages, current, end }: Props) {
  return (
    <NavTabs
      tabs={pages.map(p => ({
        id: p.id,
        href: toHref({ path: p.path, search: "" }, hashMode()),
        current: p.id === current.id,
        title: p.sections.join(" · "),
      }))}
      anchors={current.sections.map(s => ({ id: s }))}
      title={current.title}
      end={end}
      onNavigate={t => navigate(pages.find(p => p.id === t.id)?.path ?? t.href)}
    />
  )
}
