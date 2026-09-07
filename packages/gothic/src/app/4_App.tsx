import { SignalReact } from "@hafley66/signals/react"
import { useEffect } from "react"
import { Header } from "../ui/3_Header.js"
import { PAGES, matchPage } from "./0_pages.js"
import { listen, loc } from "./1_router.js"
import { setActivePage, syncFromUrl } from "./2_state.js"
import { armTransitions } from "./3_view.js"

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
      <Header pages={PAGES} current={page} />
      <main className="grid gap-6">
        <Body />
      </main>
    </>
  )
})
