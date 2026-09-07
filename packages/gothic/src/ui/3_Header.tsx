import { NavTabs } from "@hafley66/report-shell"
import { SignalReact } from "@hafley66/signals/react"
import type { PageDef } from "../app/0_pages.js"
import { hashMode, navigate, toHref } from "../app/1_router.js"

type Props = { pages: readonly PageDef[]; current: PageDef }

// the kit tab row over gothic's pages: tabs = files, anchors = the current page's sections
export const Header = SignalReact(function Header({ pages, current }: Props) {
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
      onNavigate={t => navigate(pages.find(p => p.id === t.id)?.path ?? t.href)}
    />
  )
})
