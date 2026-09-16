// The demo is the argument: an author writes plain RxJS, or plain notation, and gets a diagram.
// Nothing here subscribes — the widget connects the clock when it reads the playhead.

import { createRoot } from "react-dom/client"
import { interval, mergeMap, switchMap, take } from "rxjs"
import type { MarbleDoc } from "./0_types.js"
import { readMarbles } from "./1_notation.js"
import { runMarbleDemo } from "./2_run.js"
import { MarbleDiagram, useMarblePlayer } from "./react.js"
import "./marbles.css"

const outer = interval(12).pipe(take(3))
const inner = interval(4).pipe(take(3))

/** Real RxJS on a virtual clock: `switchMap` re-subscribes and drops the request, `mergeMap` keeps it. */
const fromRxjs = runMarbleDemo(
  { outer, switched: outer.pipe(switchMap(() => inner)), merged: outer.pipe(mergeMap(() => inner)) },
  {
    frames: 60,
    parents: { switched: "outer", merged: "outer" },
    labels: { outer: "interval(12)", switched: "switchMap", merged: "mergeMap" },
    title: "switchMap drops the inner request, mergeMap keeps it",
  },
)

/** The same idea written by hand, including a window that only a drawing can show. */
const fromNotation = readMarbles(
  [
    "@title written as notation: map, debounce, throttle, and a subscription window",
    "@legend k=key r=request",
    "",
    "keys      : -k-k-k-------|",
    "  mapped    : -r-r-r-------|",
    "  debounced : -------r-----|",
    "  throttled : -r---r-------|",
    "hot       : -k-^--k--!",
  ].join("\n"),
)

function Demo({ title, note, doc }: { title: string; note: string; doc: MarbleDoc }) {
  const player = useMarblePlayer(doc)
  return (
    <section className="demo">
      <h1>{title}</h1>
      <p>{note}</p>
      <MarbleDiagram player={player} />
    </section>
  )
}

function App() {
  return (
    <main>
      <Demo
        title="from RxJS — a virtual clock ran this"
        note="interval(12) and the two lanes derived from it; the frames are what actually happened"
        doc={fromRxjs}
      />
      <Demo
        title="from notation — nobody ran this"
        note="the hot lane shows a key emitted before the subscription and the frame it stopped listening"
        doc={fromNotation}
      />
    </main>
  )
}

const host = document.getElementById("root")
if (host !== null) createRoot(host).render(<App />)
