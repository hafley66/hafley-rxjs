import { Observable } from "rxjs"

export type GestureHint = {
  readonly gesture: string
  readonly action: string
}

/** What the document renderer's own handlers do, in the order a reader tries them. */
export const DOCUMENT_GESTURES: readonly GestureHint[] = [
  { gesture: "scroll", action: "pan up and down" },
  { gesture: "shift + scroll", action: "pan left and right" },
  { gesture: "cmd + scroll", action: "zoom at the cursor" },
  { gesture: "pinch", action: "zoom at the cursor" },
  { gesture: "drag", action: "pan" },
  { gesture: "drag on text", action: "select text" },
]

export type GestureLegendHandle = {
  readonly element: HTMLElement
  readonly setOpen: (open: boolean) => void
  readonly toggled$: Observable<boolean>
  readonly remove: () => void
}

const STYLE_ID = "grapht-gesture-legend-css"

const CSS = `
[data-gesture-legend] {
  position: absolute; right: 12px; bottom: 12px; z-index: 12;
  display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
  font: 12px/1.5 ui-monospace, Menlo, monospace; color: #0A0F25;
}
[data-gesture-legend] button {
  width: 26px; height: 26px; border-radius: 13px; cursor: pointer;
  background: #E3E9FD; color: #0A0F25; border: 1px solid #0D32B2;
}
[data-gesture-legend] dl {
  margin: 0; padding: 8px 10px; border-radius: 6px; display: none;
  background: #F7F8FE; border: 1px solid #0D32B2; box-shadow: 0 2px 8px rgb(10 15 37 / 18%);
}
[data-gesture-legend]:hover dl,
[data-gesture-legend][data-open="true"] dl { display: grid; grid-template-columns: auto auto; column-gap: 12px; }
[data-gesture-legend] dt { font-weight: 600; white-space: nowrap; }
[data-gesture-legend] dd { margin: 0; opacity: .8; white-space: nowrap; }
`

/**
 * A corner legend naming the gestures a renderer answers. Hover reveals it and the button pins it,
 * so a reader who already knows the gestures keeps the corner back. Painting the pinned state is
 * left to `toggled$`, which the application runs at its own boundary.
 */
export function createGestureLegend(host: HTMLElement, hints: readonly GestureHint[] = DOCUMENT_GESTURES): GestureLegendHandle {
  const document = host.ownerDocument
  if (document.getElementById(STYLE_ID) === null) {
    const style = document.createElement("style")
    style.id = STYLE_ID
    style.textContent = CSS
    document.head.appendChild(style)
  }

  const element = document.createElement("div")
  element.setAttribute("data-gesture-legend", "")
  element.setAttribute("data-open", "false")

  const button = document.createElement("button")
  button.type = "button"
  button.setAttribute("data-legend-toggle", "")
  button.setAttribute("aria-expanded", "false")
  button.setAttribute("aria-label", "gestures")
  button.textContent = "?"

  const list = document.createElement("dl")
  list.setAttribute("data-legend-body", "")
  for (const hint of hints) {
    const term = document.createElement("dt")
    term.textContent = hint.gesture
    const detail = document.createElement("dd")
    detail.textContent = hint.action
    list.append(term, detail)
  }

  element.append(list, button)
  host.appendChild(element)

  const setOpen = (open: boolean): void => {
    element.setAttribute("data-open", String(open))
    button.setAttribute("aria-expanded", String(open))
  }

  const toggled$ = new Observable<boolean>(subscriber => {
    const onClick = (): void => subscriber.next(element.getAttribute("data-open") !== "true")
    button.addEventListener("click", onClick)
    return () => button.removeEventListener("click", onClick)
  })

  return { element, setOpen, toggled$, remove: () => element.remove() }
}
