import { Signal } from "@hafley66/signals/Signal"
import { from, fromEvent, map, merge, switchMap, takeUntil } from "rxjs"
import { loadSvgViewportFrame, pixiSvgViewport, pixiSvgViewportRuntime } from "./17_svgViewport.js"

type Format = "mermaid" | "d2-sequence" | "d2-code"

const sources: Record<Format, URL> = {
  mermaid: new URL("../../../../../fixtures/sequence/6_mermaid.svg", import.meta.url),
  "d2-sequence": new URL("../../../../../fixtures/sequence/10_d2.svg", import.meta.url),
  "d2-code": new URL("../../../../../fixtures/sequence/27_d2_code.svg", import.meta.url),
}

const mount = document.querySelector<HTMLElement>("#sequence-formats")
const output = document.querySelector<HTMLOutputElement>("#receipt")
if (!mount || !output) throw new Error("sequence format lab mount missing")
const host = mount
const receipt = output

const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-format]")]
const format = Signal<Format>(merge(...buttons.map(button => fromEvent(button, "click").pipe(
  map(() => button.dataset.format as Format),
))), "mermaid")

pixiSvgViewportRuntime(host).pipe(
  switchMap(({ app, viewport }) => format.$.pipe(
    switchMap(selected => from(loadSvgViewportFrame(selected, sources[selected]))),
    pixiSvgViewport({ app, viewport, buttons, receipt })(host),
  )),
  takeUntil(fromEvent(window, "pagehide")),
).subscribe()
