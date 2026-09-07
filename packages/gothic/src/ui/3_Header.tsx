import { SignalReact } from "@hafley66/signals/react"
import { useEffect, useRef } from "react"
import type { PageDef } from "../app/0_pages.js"
import { hashMode, navigate, toHref } from "../app/1_router.js"
import { pageState } from "../app/2_state.js"
import { useResizeVar } from "./0_hooks.js"

type Props = { pages: readonly PageDef[]; current: PageDef }

// fixed grid: row 1 = file tabs + global controls, row 2 = section anchors, row 3 = the page title
export const Header = SignalReact(function Header({ pages, current }: Props) {
  const ref = useRef<HTMLElement>(null)
  useResizeVar(ref, "--kit-top")
  const page = pageState()
  const { z, draw } = page.values.$()

  useEffect(() => {
    document.documentElement.style.setProperty("--kit-zdepth", String(z))
    document.documentElement.style.setProperty("--kit-ms", draw ? "1400ms" : "0ms")
  }, [z, draw])

  return (
    <header
      ref={ref}
      className="kit-top sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-[3px] border-line border-b bg-panel px-3.5 py-1.5 text-muted"
    >
      <nav className="kit-files flex min-w-0 flex-wrap gap-x-3">
        {pages.map(p => (
          <a
            key={p.id}
            href={toHref({ path: p.path, search: "" }, hashMode())}
            data-tab={p.id}
            aria-current={p.id === current.id ? "page" : undefined}
            title={p.sections.join(" · ")}
            className={`border-b-2 py-px no-underline ${p.id === current.id ? "border-ink text-ink" : "border-transparent text-muted hover:text-fg"}`}
            onClick={e => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return
              e.preventDefault()
              navigate(p.path)
            }}
          >
            {p.id}
          </a>
        ))}
      </nav>
      <span className="kit-ctl inline-flex items-center gap-3">
        <label
          className="inline-flex items-center gap-1.5"
          title="depth fade: paths carrying data-z (0 near .. 1 far) lose opacity and width with z; 0 = flat. url ?page.z"
        >
          zDepth
          <input
            id="kit-page-z"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={z}
            className="w-24 accent-ink"
            onChange={e => page.set({ z: Number(e.currentTarget.value) })}
          />
        </label>
        <label
          className="inline-flex items-center gap-1.5"
          title="draw paths in along their length on every rerender; off renders instantly. url ?page.draw"
        >
          <input
            id="kit-page-draw"
            type="checkbox"
            checked={draw}
            className="accent-ink"
            onChange={e => page.set({ draw: e.currentTarget.checked })}
          />
          draw-in
        </label>
      </span>
      <span className="kit-sections col-span-2 flex min-w-0 flex-wrap gap-x-1">
        {current.sections.map(s => (
          <a
            key={s}
            href={`#${s}`}
            data-anchor={s}
            className="kit-anchor border-transparent border-b-2 px-1 text-muted no-underline"
          >
            {s}
          </a>
        ))}
      </span>
      <b className="kit-page-title col-span-2 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-normal text-[11px] text-dim">
        {current.title}
      </b>
    </header>
  )
})
