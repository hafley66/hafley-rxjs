import type { MouseEvent, ReactNode } from "react"
import { useRef } from "react"
import { useResizeVar } from "../lib/hooks.js"

export type Tab = { id: string; label?: string; href: string; current?: boolean; title?: string }
export type Anchor = { id: string; label?: string }
export type NavTabsProps = {
  tabs: readonly Tab[]
  anchors?: readonly Anchor[]
  title?: string
  onNavigate?(tab: Tab, e: MouseEvent<HTMLAnchorElement>): void
  end?: ReactNode
}

// fixed grid: row 1 = tabs (+ end slot), row 2 = section anchors, row 3 = the page title; height lands in --kit-top
export function NavTabs({ tabs, anchors = [], title, onNavigate, end }: NavTabsProps): ReactNode {
  const ref = useRef<HTMLElement>(null)
  useResizeVar(ref, "--kit-top")
  return (
    <header ref={ref} className="kit-top">
      <nav className="kit-files">
        {tabs.map(t => (
          <a
            key={t.id}
            href={t.href}
            data-tab={t.id}
            aria-current={t.current ? "page" : undefined}
            title={t.title}
            onClick={e => {
              if (!onNavigate || e.metaKey || e.ctrlKey || e.shiftKey) return
              e.preventDefault()
              onNavigate(t, e)
            }}
          >
            {t.label ?? t.id}
          </a>
        ))}
        {end && <span className="kit-top-end">{end}</span>}
      </nav>
      {anchors.length > 0 && (
        <span className="kit-sections">
          {anchors.map(a => (
            <a key={a.id} href={`#${a.id}`} data-anchor={a.id} className="kit-anchor">
              {a.label ?? a.id}
            </a>
          ))}
        </span>
      )}
      {title !== undefined && <b className="kit-page-title">{title}</b>}
    </header>
  )
}
