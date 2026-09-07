import { SignalReact } from "@hafley66/signals/react"
import { useEffect } from "react"
import { Header } from "../ui/3_Header.js"
import { matchPage, PAGES } from "./0_pages.js"
import { listen, loc } from "./1_router.js"
import { pageState, setActivePage, syncFromUrl } from "./2_state.js"
import { armTransitions } from "./3_view.js"

// page-global knobs in the tab row end slot: depth fade and draw-in; both travel as ?page.z / ?page.draw
const PagePanel = SignalReact(function PagePanel() {
  const page = pageState()
  const { z, draw } = page.values.$()
  useEffect(() => {
    document.documentElement.style.setProperty("--kit-zdepth", String(z))
    document.documentElement.style.setProperty("--kit-ms", draw ? "1400ms" : "0ms")
  }, [z, draw])
  return (
    <span className="kit-page">
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

  return (
    <>
      <Header pages={PAGES} current={page} end={<PagePanel />} />
      <main className="grid gap-6">
        <Body />
      </main>
    </>
  )
})
