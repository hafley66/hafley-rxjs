// The demo is the argument. Each diagram is a thing the old surface could not say:
//
//   1. one synchronous burst is ONE column, and giving each value its own scheduler turn is three
//   2. `switchMap` cancels a subscription and the diagram shows the cancellation, on its own lane
//   3. `mergeScan` carries an accumulator between subscriptions and `switchScan` cancels as it carries
//   4. `groupBy` opens a lane per key, on the turn the key first appeared, and routes each value to it
//   5. `expand` recurses, and the diagram follows the event that spawned each depth
//   6. a document written by hand says the same things without counting a single `-`
//
// Nothing here subscribes: the widget connects the clock when it reads the reveal. The one boundary
// in this file is the performance readout, and `runWhenInView` owns that subscription — it samples
// while the demo is on screen and drops the subscription when it is not, so a HUD nobody is looking
// at costs no frames.

import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { performanceReadout } from "@hafley66/trace"
import { useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { asapScheduler, concatMap, from, groupBy, interval, map, observeOn, of, take } from "rxjs"
import { marbleDoc } from "./0_document.js"
import type { MarbleDoc } from "./0_types.js"
import { readMarbleDemo, runMarbleDemo } from "./2_run.js"
import { MarbleDiagram, useMarblePlayer } from "./react.js"
import "./marbles.css"

/** One synchronous burst: three values, one completion, one turn. */
const burst = runMarbleDemo({ burst: of(1, 2, 3) }, { title: "of(1, 2, 3) is one turn" })

/** The same three values, each rescheduled: three turns, all at the same millisecond. */
const turns = runMarbleDemo(
  { turns: of(1, 2, 3).pipe(concatMap(value => of(value).pipe(observeOn(asapScheduler)))) },
  { title: "rescheduled: a turn each, and still 0ms" },
)

/** `switchMap` re-subscribes and drops the request; `mergeMap` lets it finish. Inner lanes included. */
const higher = runMarbleDemo(
  lanes => {
    const outer = lanes.through("outer", interval(12).pipe(take(3)), { label: "interval(12)" })
    lanes.each("switched", outer, () => interval(6).pipe(take(3)), {
      op: "switch",
      name: "request",
      label: "switchMap",
      parent: "outer",
    })
    lanes.each("merged", outer, () => interval(6).pipe(take(3)), {
      op: "merge",
      name: "inner",
      label: "mergeMap",
      parent: "outer",
    })
  },
  { windowMs: 60, title: "switchMap drops the inner request, mergeMap keeps it" },
)

/** The scan forms: the accumulator the diagram carries, and the inner the switch form cancels. */
const scans = runMarbleDemo(
  lanes => {
    const values = lanes.through(
      "values",
      interval(12).pipe(
        take(4),
        map(index => index + 1),
      ),
      { label: "1..4" },
    )
    lanes.each("merged", values, value => of((value as number) * 2), {
      op: "merge",
      name: "mergeScan",
      label: "mergeScan",
      parent: "values",
      seed: 0,
    })
    lanes.each(
      "switched",
      values,
      value =>
        interval(6).pipe(
          take(2),
          map(index => (value as number) * 10 + index),
        ),
      {
        op: "switch",
        name: "switchScan",
        label: "switchScan",
        parent: "values",
        seed: 0,
      },
    )
  },
  { windowMs: 70, title: "mergeScan carries the last value it saw; switchScan cancels as it carries" },
)

/** A lane per key, opened on the turn the key first appeared, with every value routed to it. */
const grouped = runMarbleDemo(
  lanes => {
    const keys = lanes.through(
      "keys",
      interval(12).pipe(
        take(6),
        map(index => "abacba"[index] ?? ""),
      ),
      {
        label: "keys",
      },
    )
    lanes.each("merged", keys.pipe(groupBy(value => value)), group => group as never, {
      op: "merge",
      name: "group",
      label: "the groups",
      parent: "keys",
      innerLabel: value => `key ${String((value as { key: unknown }).key)}`,
    })
  },
  { windowMs: 80, title: "groupBy: a lane per key, opened when the key appears" },
)

/** Recursion: each lane is born from the event that spawned it. */
const tree: Record<string, string[]> = { root: ["a", "b"], a: ["a1"], b: ["b1"] }
const expanded = runMarbleDemo(
  lanes => {
    lanes.each("tree", of("root"), value => from(tree[value as string] ?? []), {
      op: "expand",
      name: "expand",
      label: "the tree",
    })
  },
  { title: "expand: recursion, one lane per depth" },
)

/**
 * The other producer: written by hand. The author says which turn an event is on and how much time
 * it cost, and nothing is aligned. Every note here is authored, and is the reason the diagram exists.
 */
const authored: MarbleDoc = marbleDoc({
  title: "written with marbleDoc: a debounce against a switch",
  lanes: [
    {
      id: "keys",
      label: "keys",
      events: [
        { tick: 1, value: "k" },
        { after: 2, value: "k", note: "still typing" },
        { after: 2, value: "k" },
        { after: 1, ms: 300, value: "idle", note: "300ms of quiet — nothing in this gap" },
        { kind: "complete", note: "the keyboard stopped listening" },
      ],
    },
    {
      id: "debounced",
      label: "debounced",
      parent: "keys",
      events: [{ tick: 7, value: "request", note: "sent only because the gap was long enough" }, { kind: "complete" }],
    },
    {
      id: "cancelled",
      label: "switched away",
      parent: "keys",
      events: [
        { tick: 3, value: "request", note: "started, then abandoned" },
        { tick: 5, kind: "unsubscribe", note: "the next key arrived first" },
      ],
    },
  ],
})

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

/**
 * The debug view from the docs shell, pointed at a diagram. It reports the frames this page actually
 * painted, the worst one, how many ran long, and a page-wide heap estimate — so "what does playing a
 * diagram cost" is a number and not an opinion. The gate is the demo element: a readout of something
 * nobody is looking at is a frame per burst spent on numbers nobody reads.
 */
function PerformanceHud({ target }: { target: HTMLElement }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = host.current
    if (element === null) return
    const perf = performanceReadout(target)
    element.append(perf.el)
    return mountInView(target, () => runWhenInView(perf.painted$))
  }, [target])
  return <div className="demo-hud" ref={host} />
}

function App() {
  const [app, setApp] = useState<HTMLElement | null>(null)
  return (
    <>
      <main ref={setApp}>
        <Demo
          title="from RxJS — a virtual clock ran this"
          note="the runner drains the clock one action per column, so a turn of the queue is a column even when no time passed"
          doc={burst.doc}
        />
        <Demo
          title="the same values, given their own turns"
          note="three columns, all at 0ms — which is exactly what a timeline cannot show"
          doc={turns.doc}
        />
        <Demo
          title="the cancellation is on the diagram"
          note="each inner lane is named, born from the outer value that started it, and ends complete or cancelled"
          doc={higher.doc}
        />
        <Demo
          title="accumulation, and accumulation with a cancellation"
          note="a seed is written on the inner that received it; a cancelled inner says who dropped it"
          doc={scans.doc}
        />
        <Demo
          title="a lane per key"
          note="a group lane opens on the turn its key first appears, and every value it carries says which source event routed it there"
          doc={grouped.doc}
        />
        <Demo
          title="recursion"
          note="every lane is born from the event that spawned it, so the tree is the parent chain"
          doc={expanded.doc}
        />
        <Demo
          title="from marbleDoc — nobody ran this"
          note="no alignment, no counting: a turn and a cost per event, a note for every why"
          doc={authored}
        />
        <p className="demo-foot">
          {readMarbleDemo(burst).lanes[0]?.label ?? ""} — every diagram above is one document, and every document is in
          the details under it.
        </p>
      </main>
      {app === null ? null : <PerformanceHud target={app} />}
    </>
  )
}

const host = document.getElementById("root")
if (host !== null) createRoot(host).render(<App />)
