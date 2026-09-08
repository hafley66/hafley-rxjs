import { pinSet } from "@hafley66/report-shell"
import { useEffect } from "react"
import { Header } from "../ui/3_Header.js"
import { matchPage, PAGES } from "./0_pages.js"
import { listen, loc } from "./1_router.js"
import { pageState, sections, setActivePage, syncFromUrl } from "./2_state.js"
import { armTransitions } from "./3_view.js"
import { propertyMotion } from "../kit/4_propertyMotion.js"
import { PropertySettings, PropertyTransport } from "../ui/1d_PropertySettings.js"
import { VariationDefaults } from "../ui/1e_VariationControls.js"

// page-global knobs in the tab row end slot: depth fade and draw-in; both travel as ?page.z / ?page.draw
function PagePanel() {
  const page = pageState()
  const { z, draw } = propertyMotion("*").values(page).$()
  const pins = pinSet(page.pins.$())
  useEffect(() => {
    document.documentElement.style.setProperty("--kit-zdepth", String(z))
    document.documentElement.style.setProperty("--kit-ms", draw ? "1400ms" : "0ms")
    document.documentElement.style.setProperty("--kit-stagger", draw ? "25ms" : "0ms")
  }, [z, draw])
  return (
    <span className="kit-page">
      <input type="checkbox" className="kit-pin" data-pin="z" aria-label="pin zDepth" title="pin zDepth: page shuffle skips it" checked={pins.has("z")} onChange={() => page.togglePin("z")} />
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
      <button type="button" className="kit-roll" title="reroll zDepth only" onClick={() => page.roll("z")}>↻</button>
      <PropertySettings state={page as never} field={page.spec.z} name="z" />
      <input type="checkbox" className="kit-pin" data-pin="draw" aria-label="pin draw-in" title="pin draw-in: page shuffle skips it" checked={pins.has("draw")} onChange={() => page.togglePin("draw")} />
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
      <button type="button" className="kit-roll" title="reroll draw-in only" onClick={() => page.roll("draw")}>↻</button>
      <PropertySettings state={page as never} field={page.spec.draw} name="draw" />
      <button type="button" title="shuffle unpinned page controls" onClick={() => page.rollAll()}>shuffle</button>
      <button type="button" className="kit-shuffle" data-shuffle-all title="shuffle all: every section on this page and the page controls reroll their unpinned fields from one seed; one history entry" onClick={() => sections.shuffleAll()}>shuffle all</button>
    </span>
  )
}

export function App() {
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
      <div className="border-b border-edge bg-bg px-4" data-property-transport={page.id}>
        <span title="Play, hold or scrub the property animation clock">Property animation</span>{" · "}<VariationDefaults page={page.id} />
        <PropertyTransport model={propertyMotion(page.id)} />
      </div>
      <main className="grid gap-6">
        <Body />
      </main>
    </>
  )
}
