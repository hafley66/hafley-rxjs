import type { AnySpec, ValuesOf } from "@hafley66/report-shell"
import { useEffect, useRef } from "react"
import type { PageSpec } from "../app/0_pages.js"
import { attach, detach, presets, reseed } from "../lib/legacy/4_frames.js"
import { Section } from "../ui/2_Section.js"

const SPEC = {
  preset: {
    kind: "select",
    hint: "frame composition preset from the legacy frames notebook",
    options: Object.keys(presets),
    default: "kingdom",
  },
  density: {
    kind: "range",
    hint: "ornament density: 0 = bare frame, 3 = every motif layer",
    min: 0,
    max: 3,
    default: 1,
  },
  weight: {
    kind: "range",
    hint: "stroke width multiplier for every path in the section",
    min: 0.5,
    max: 2,
    step: 0.05,
    default: 1,
  },
  idle: {
    kind: "range",
    hint: "opacity of the idle (non-hovered) frames",
    min: 0.1,
    max: 1,
    step: 0.05,
    default: 0.55,
  },
  ink: { kind: "text", hint: "stroke colour, any css colour", default: "#e2c477", pool: ["#e2c477", "#90c7d2", "#caa1c7", "#c4d6ab", "#e0a891"], size: 8 },
} as const satisfies AnySpec
type V = ValuesOf<typeof SPEC>
const SIZER = {
  seed: { kind: "seed", hint: "seed for the size ladder; reseed all rolls every frame on the page", default: 1 },
} as const satisfies AnySpec

const PANE = "pane relative overflow-hidden rounded-sm bg-well p-6 text-fg"

// every .gothic host gets one frame mount; the lib owns the ResizeObserver and the geometry
function useFrames(root: { current: HTMLElement | null }, v: V, extra: unknown[] = []) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: the knobs listed are the ones that replan every host
  useEffect(() => {
    const hosts = [...(root.current?.querySelectorAll<HTMLElement>(".gothic") ?? [])]
    for (const el of hosts) attach(el, { preset: v.preset, density: v.density, weight: v.weight })
    document.documentElement.style.setProperty("--gothic-idle", String(v.idle))
    document.documentElement.style.setProperty("--gothic-ink", v.ink)
    return () => {
      for (const el of hosts) detach(el)
    }
  }, [v.preset, v.density, v.weight, v.idle, v.ink, ...extra])
}

function Frames({ v, reseedRef }: { v: V; reseedRef: { current: HTMLButtonElement | null } }) {
  const root = useRef<HTMLDivElement>(null)
  useFrames(root, v)
  useEffect(() => {
    const btn = reseedRef.current
    if (!btn) return
    const fn = () => {
      for (const el of root.current?.querySelectorAll<HTMLElement>(".gothic") ?? []) reseed(el)
    }
    btn.addEventListener("click", fn)
    return () => btn.removeEventListener("click", fn)
  }, [reseedRef])
  return (
    <div ref={root} className="grid gap-4">
      <section className={`${PANE} gothic min-h-40`}>
        <h1 className="font-normal text-2xl">Frames that stay out of the way</h1>
        <p className="text-muted">Sans body text is the content. The ornament is a whisper at the corners.</p>
      </section>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4">
        <section className={`${PANE} gothic`}>
          <h2 className="mb-1 font-medium">Card one</h2>
          <p className="text-muted">
            Same preset, different seed. Corners agree with each other inside an element and disagree across elements.
          </p>
        </section>
        <section className={`${PANE} gothic`}>
          <h2 className="mb-1 font-medium">Card two</h2>
          <p className="text-muted">
            Radius budget is derived from min(width, height), so the flourish never outgrows the box.
          </p>
        </section>
        <section className={`${PANE} gothic`}>
          <h2 className="mb-1 font-medium">Card three</h2>
          <p className="text-muted">Hover or focus raises one custom property. No geometry is recomputed on events.</p>
        </section>
      </div>
      <div className="grid grid-cols-[12rem_1fr] gap-4">
        <section className={`${PANE} gothic h-64`}>
          <h2 className="mb-1 font-medium">Tall</h2>
          <p className="text-muted">Narrow boxes shrink the corner and drop the finial.</p>
        </section>
        <section className={`${PANE} gothic`}>
          <h2 className="mb-1 font-medium">Wide bar</h2>
          <p className="text-muted">Long edges earn midpoint finials.</p>
        </section>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={`${PANE} gothic px-6 py-2`}>
          Confirm
        </button>
        <button type="button" className={`${PANE} gothic px-6 py-2`}>
          Cancel
        </button>
        <button type="button" className={`${PANE} gothic px-6 py-2`}>
          Open menu
        </button>
      </div>
    </div>
  )
}

function Sizers({ v, seed }: { v: V; seed: number }) {
  const root = useRef<HTMLDivElement>(null)
  useFrames(root, v, [seed])
  useEffect(() => {
    let i = 0
    for (const el of root.current?.querySelectorAll<HTMLElement>(".gothic") ?? []) reseed(el, seed + i++ * 7919)
  }, [seed])
  return (
    <div ref={root} className="flex flex-wrap gap-4">
      <section className={`${PANE} gothic min-h-40 min-w-64 resize overflow-auto`}>
        <h2 className="mb-1 font-medium">Resize me</h2>
        <p className="text-muted">Drag the corner. ResizeObserver replans on a 4px quantum.</p>
      </section>
      <section className={`${PANE} gothic min-h-40 min-w-64 resize overflow-auto`}>
        <h2 className="mb-1 font-medium">Resize me too</h2>
        <p className="text-muted">Second sizer, independent seed.</p>
      </section>
    </div>
  )
}

function FramesPage() {
  const reseedRef = useRef<HTMLButtonElement>(null)
  const extra = (
    <button
      ref={reseedRef}
      type="button"
      className="rounded-sm border border-edge px-1.5 py-px text-fg hover:border-ink"
      title="roll a fresh seed for every frame on the page; the preset and density stay"
    >
      reseed all
    </button>
  )
  return (
    <>
      <Section page="frames" def={{ id: "frames", title: "frames", spec: SPEC }} extra={extra}>
        {v => <Frames v={v as V} reseedRef={reseedRef} />}
      </Section>
      <Section page="frames" def={{ id: "sizer", title: "sizer", spec: SIZER }}>
        {v => <SizerBody seed={Number((v as { seed: number }).seed)} />}
      </Section>
    </>
  )
}

// the sizer panes take the frames bar's own preset, so both sections stay in one visual language
function SizerBody({ seed }: { seed: number }) {
  const v = { preset: "kingdom", density: 1, weight: 1, idle: 0.55, ink: "#e2c477" } as V
  return <Sizers v={v} seed={seed} />
}

export const PAGE: PageSpec = {
  id: "frames",
  title: "gothic: frame lib (corners, rails, finials)",
  path: "/frames",
  specs: { frames: SPEC, sizer: SIZER },
  Component: FramesPage,
}
