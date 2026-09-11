// @comment-ok: the subject of this example is a thing the code cannot show, namely that no line in it opts a component in
// Plain React. No `SignalReact` wrap, no `useSignal`, no hook of any kind at a read site. Every
// component below reads a signal straight out of JSX, and re-renders when that signal changes.
//
// `signalsJsx()` is what makes that true. It runs after the JSX compiler and rewrites the
// `react/jsx-runtime` import this file was given into `@hafley66/signals/jsx-runtime`, whose `jsx`
// passes every function component through `SignalReact` on the way to React's own. The wrapper
// name in the last readout is that rewrite, observed rather than asserted.
import { flushSync } from "react-dom"
import { createRoot, type Root } from "react-dom/client"
import type { ReactNode } from "react"
import { mountInView } from "@hafley66/docs-kit"
import { Signal } from "../src/index.js"
import source from "./11_react.tsx?raw"
import type { Example } from "./0_types.js"

const left = Signal({ value: 1 })
const right = Signal({ value: 100 })

const runs = { onlyLeft: 0, both: 0, neither: 0 }

function Readout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="sx-readout" data-read={label}>
      <span className="sx-label">{label}</span>
      <code className="sx-value">{children}</code>
    </div>
  )
}

function OnlyLeft() {
  runs.onlyLeft += 1
  return <Readout label="reads left">{`${left.value.$()}, rendered ${runs.onlyLeft} times`}</Readout>
}

function Both() {
  runs.both += 1
  return <Readout label="reads both">{`${left.value.$() + right.value.$()}, rendered ${runs.both} times`}</Readout>
}

function Neither() {
  runs.neither += 1
  return <Readout label="reads neither">{`rendered ${runs.neither} times`}</Readout>
}

/** What the plugin did, read off an element rather than claimed in prose. A component the plugin
 * never saw is its own function, named `OnlyLeft`; one it did see is a wrapper named for it. */
function wrappedName(): string {
  const type = (<OnlyLeft />).type as { displayName?: string; name?: string }
  return type.displayName ?? type.name ?? "an anonymous function"
}

function Board() {
  return (
    <>
      <div className="sx-row">
        <button type="button" className="sx-button" onClick={() => left.value.$(left.value.$() + 1)}>
          write left
        </button>
        <button type="button" className="sx-button" onClick={() => right.value.$(right.value.$() + 1)}>
          write right
        </button>
      </div>
      <OnlyLeft />
      <Both />
      <Neither />
      <Readout label="what wraps OnlyLeft">{wrappedName()}</Readout>
    </>
  )
}

export const react: Example = {
  id: "react-tracking",
  title: "A React component with no hook at the read site",
  summary: "Three plain components, one signal write, and only the components that read it render again.",
  form: "react",
  source,
  mount: (host) =>
    mountInView(host, () => {
      const stage = document.createElement("div")
      stage.className = "sx-panel"
      host.append(stage)
      runs.onlyLeft = 0
      runs.both = 0
      runs.neither = 0
      let root: Root | null = createRoot(stage)
      // Synchronous, so the example check sees a painted tree on the frame after mount rather than
      // on whichever frame React's own scheduler picked.
      flushSync(() => root?.render(<Board />))
      return () => {
        root?.unmount()
        root = null
        stage.remove()
      }
    }),
}
