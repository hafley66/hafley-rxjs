import { SignalReact } from "@hafley66/signals/react"
import { useEffect, useRef } from "react"
import { useResizeVar } from "../ui/0_hooks.js"
import { RAIL_ID } from "../ui/2_Section.js"
import { Header } from "../ui/3_Header.js"
import { matchPage, PAGES } from "./0_pages.js"
import { listen, loc } from "./1_router.js"
import { pageState, setActivePage, syncFromUrl } from "./2_state.js"
import { armTransitions } from "./3_view.js"

// page-global knobs, inline in the drawer summary: depth fade and draw-in; both travel as ?page.z / ?page.draw
const PagePanel = SignalReact(function PagePanel() {
  const page = pageState()
  const { z, draw } = page.values.$()
  useEffect(() => {
    document.documentElement.style.setProperty("--kit-zdepth", String(z))
    document.documentElement.style.setProperty("--kit-ms", draw ? "1400ms" : "0ms")
  }, [z, draw])
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: stops the summary toggle, the inputs inside are the controls
    // biome-ignore lint/a11y/useKeyWithClickEvents: same, click only exists to stop the toggle
    <span className="kit-page" onClick={e => e.stopPropagation()}>
      <label
        htmlFor="kit-page-z"
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
          onChange={e => page.set({ z: Number(e.currentTarget.value) })}
        />
        <output>{z}</output>
      </label>
      <label
        htmlFor="kit-page-draw"
        title="draw paths in along their length on every rerender; off renders instantly. url ?page.draw"
      >
        <input
          id="kit-page-draw"
          type="checkbox"
          checked={draw}
          onChange={e => page.set({ draw: e.currentTarget.checked })}
        />
        draw-in
      </label>
    </span>
  )
})

export const App = SignalReact(function App() {
  const l = loc.$()
  const page = matchPage(l.path)
  const Body = page.Component

  useEffect(() => listen(), [])
  useEffect(() => {
    setActivePage(page.id, loc.$().search)
  }, [page.id])
  useEffect(() => {
    syncFromUrl(l.search)
  }, [l.search])
  useEffect(() => {
    document.title = page.title
  }, [page.title])
  useEffect(() => armTransitions(), [])
  const drawer = useRef<HTMLElement>(null)
  useResizeVar(drawer, "--kit-drawer")

  return (
    <>
      <Header pages={PAGES} current={page} />
      <details className="kit-drawer" ref={drawer as never} open>
        <summary title="every knob of this page; click to fold the drawer">
          <span className="kit-drawer-tag">knobs</span>
          <PagePanel />
        </summary>
        <div id={RAIL_ID} className="kit-panels" key={page.id} />
      </details>
      <main className="grid gap-6">
        <Body />
      </main>
    </>
  )
})
