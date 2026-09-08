import type { AnySpec, SectionState } from "@hafley66/report-shell"
import { Signal } from "@hafley66/signals"
import { useMemo } from "react"
import { distinctUntilChanged, EMPTY, fromEvent, ignoreElements, merge, switchMap, takeUntil, tap } from "rxjs"
import { sectionState } from "../app/2_state.js"
import { type Algo, algoCtx } from "../kit/2_algo.js"
import type { MotionParams } from "../kit/3_motion.js"
import { PLAYBACK_PRESETS } from "../kit/0_inputs.js"
import { playback, type PlaybackRuntime } from "../kit/1a_playback.js"
import { inViewport } from "../kit/1_browser.js"
import { AnimationControls } from "./1b_AnimationControls.js"
import { Section } from "./2_Section.js"
import { propertyMotion } from "../kit/4_propertyMotion.js"

type MovingProps<P extends MotionParams> = {
  algo: Algo<P>
  title: string
  subtitle: string
  gesture: "scrub" | "view" | "seed"
  duration: number
  loop?: boolean
}

function MovingBody<P extends MotionParams>({
  algo, state, title, subtitle, gesture, duration, loop = true,
}: MovingProps<P> & { state: SectionState<AnySpec> }) {
  const model = useMemo(() => {
    const runtime = Signal<PlaybackRuntime & { node: Element | null }>({ node: null, enabled: typeof matchMedia !== "function" || !matchMedia("(prefers-reduced-motion: reduce)").matches, seek: null })
    const motion = playback(state.values as unknown as Signal<MotionParams>, duration * 1000, { input: propertyMotion(state.page).values(state) as unknown as Signal<MotionParams>, loop, runtime: runtime as unknown as Signal<PlaybackRuntime>, visible: inViewport(runtime.node.$) })
    const hold = (time: number) => {
      const next = Number(Math.max(0, Math.min(1, time)).toFixed(3))
      state.set({ time: next, run: false })
      motion.seek(next * duration * 1000)
    }
    const gestures = Signal(runtime.node.$.pipe(distinctUntilChanged(), switchMap(node => node ? fromEvent<PointerEvent>(node, "pointerdown").pipe(switchMap(down => {
      if (down.button !== 0) return EMPTY
      const box = node.getBoundingClientRect()
      const x = (down.clientX - box.left) / box.width - 0.5
      const y = (down.clientY - box.top) / box.height - 0.5
      if (gesture === "seed") {
        const p = state.values.$(), petals = Number(p.petals)
        const focus = Math.round((Math.atan2(x, -y) / (Math.PI * 2) + 1) * petals) % petals
        state.set({ focus, seed: Number(p.seed) + 1, time: 0, run: true }, "push")
        motion.replay()
        return EMPTY
      }
      down.preventDefault()
      node.setPointerCapture(down.pointerId)
      const origin = motion.frame.time.$() / (duration * 1000)
      if (gesture === "scrub") hold(origin)
      return fromEvent<PointerEvent>(node, "pointermove").pipe(
        takeUntil(merge(fromEvent(node, "pointerup"), fromEvent(node, "pointercancel"), fromEvent(node, "lostpointercapture"))),
        tap(move => {
          if (gesture === "scrub") hold(((origin + (move.clientX - down.clientX) / box.width * 2) % 1 + 1) % 1)
          else state.set({ lean: Math.max(-1, Math.min(1, (move.clientX - box.left) / box.width * 2 - 1)) })
        }),
      )
    })) : EMPTY), ignoreElements()), null)
    return { motion, gestures, hold, ref(node: SVGSVGElement | null) { runtime.node.$(node) } }
  }, [state, loop, duration, gesture])
  const { motion, hold } = model
  model.gestures.$()
  const v = propertyMotion(state.page).values(state).$() as P
  const frame = motion.frame.$()
  const time = frame.time / (duration * 1000), running = frame.active
  const out = algo.run({ ...v, time }, algoCtx(v, 720))
  const studies = useMemo(() => [0, gesture === "seed" ? 1 : 0.5].map((time, i) => ({
    time, out: algo.run({ ...v, time }, algoCtx(v, 256 + i)),
  })), [algo, v])
  return (
    <div className="mx-auto max-w-[1060px] py-4">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-2xl tracking-wide text-[#ded7be]">{title}</h3>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_200px]">
        <div>
          <svg ref={model.ref} viewBox="-360 -360 720 720" width="720" height="720" role="img" aria-label={title}
            data-art={algo.name} data-time={time.toFixed(4)} tabIndex={0}
            className="block h-auto w-full touch-none overflow-hidden rounded-sm border border-[#35423e] focus-visible:outline-2 focus-visible:outline-ink"
            style={{ cursor: gesture === "seed" ? "crosshair" : "ew-resize" }}
            onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); hold(time + (e.key === "ArrowRight" ? 0.01 : -0.01)) } }}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: pure generator markup; no user strings
            dangerouslySetInnerHTML={{ __html: `<title>${title}</title>${out.raw?.join("") ?? ""}` }} />
          <AnimationControls label={title} time={time} running={running} loop={loop} onSeek={hold} onToggle={() => {
              motion.runtime.enabled.$(true)
              const next = !loop && time >= 1 ? 0 : time
              motion.runtime.seek.$({ time: next * duration * 1000 })
              state.set({ time: Number(next.toFixed(3)), run: !running })
            }} onReplay={() => { state.set({ time: 0, run: true }); motion.replay() }} />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          {studies.map(({ out, time }, i) => <button key={time} className="group text-left" title={`Hold the ${time === 0 ? "initial" : "later"} frame`} onClick={() => hold(time)}>
            <svg viewBox={`${-(256 + i) / 2} ${-(256 + i) / 2} ${256 + i} ${256 + i}`} width="256" height="256" role="img" aria-label={`${title}, ${time === 0 ? "initial" : "later"} frame`} className="h-auto w-full overflow-hidden border border-line group-hover:border-ink"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: pure generator markup
              dangerouslySetInnerHTML={{ __html: out.raw?.join("") ?? "" }} />
            <span className="mt-2 block font-mono text-[10px] uppercase tracking-[.16em] text-muted">{time === 0 ? "I · origin" : gesture === "seed" ? "II · limestone" : "II · displacement"}</span>
          </button>)}
          <p className="col-span-2 text-[11px] leading-relaxed text-muted lg:col-span-1">{gesture === "scrub" ? "Drag the brass disk. A slight turn moves the broad interference pattern across the dial." : gesture === "view" ? "Drag to move across the nave. Hold a frame as the crown joints open." : "Click a petal to begin a new growth. Fine filaments become the next stone tracery."}</p>
        </div>
      </div>
    </div>
  )
}

export function MovingAlgo<P extends MotionParams>(props: MovingProps<P> & { page: string }) {
  const { algo, page, title } = props
  const presets = { ...PLAYBACK_PRESETS, ...algo.presets }
  const state = sectionState(page, algo.name, algo.spec as AnySpec, presets as never)
  return <Section page={page} def={{ id: algo.name, title, spec: algo.spec as AnySpec, presets: presets as never }}>
    {() => <MovingBody {...props} state={state} />}
  </Section>
}
