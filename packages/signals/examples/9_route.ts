// A producer over the URL. The template's parameters come back by name on the signal's value, and
// `href` prints the other direction. Reading and printing only: navigating would leave the page.
import { fromEvent, merge, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { Route } from "../src/index.js"
import { button, panel, readout, row } from "./0_dom.js"
import source from "./9_route.ts?raw"
import type { Example } from "./0_types.js"

const PAGES = ["forms", "derive", "slice"] as const

export const routed: Example = {
  id: "route-signal",
  title: "A signal that reads the URL",
  summary: "One template, matched against the address bar, with the parameters read back by name.",
  form: "producer",
  source,
  mount: (host) =>
    mountInView(host, () => {
      const root = panel(host)
      const controls = row(root)
      const next = button("print the next href", controls)
      const template = readout("the template", root)
      const matched = readout("does it match here", root)
      const params = readout("what it read", root)
      const printed = readout("href it would navigate to", root)

      const route = Route("/hafley-rxjs/signals/:page")

      let step = 0
      const printed$ = fromEvent(next, "click").pipe(
        tap(() => {
          step += 1
          printed.write(route.href({ page: PAGES[step % PAGES.length] ?? "forms" }))
        }),
      )

      const shown$ = route.$.pipe(
        tap((it) => {
          template.write(route.template)
          matched.write(String(it.matched))
          params.write(it.matched ? `page is ${it.page}` : `the path is ${it.path}`)
        }),
      )

      printed.write(route.href({ page: PAGES[0] }))

      const stop = runWhenInView(merge(printed$, shown$))
      return () => {
        stop()
        root.remove()
      }
    }),
}
