import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import { Signal } from "@hafley66/signals"
import { useEffect, useMemo, useRef, type ReactNode } from "react"
import svgpath from "svgpath"
import { ALGO, generate, type Params } from "../algos/18_vello.js"
import type { PageSpec } from "../app/0_pages.js"
import { algoCtx } from "../kit/2_algo.js"
import { AlgoSvg } from "../ui/4_Algo.js"
import { Section } from "../ui/2_Section.js"
import wasmUrl from "../wasm/gothic_vello_bg.wasm?url"

// vello only strokes M/L/C/Z; lower arcs (unarc), shorthands (unshort) and quadratics (degree elevation) here
function toCubics(d: string): string {
  let out = ""
  svgpath(d)
    .abs()
    .unshort()
    .unarc()
    .iterate((seg, _i, x, y) => {
      const c = seg[0].toUpperCase()
      const g = (i: number): number => Number(seg[i] ?? 0)
      if (c === "M") out += `M${g(1)} ${g(2)}`
      else if (c === "L" || c === "H" || c === "V") out += `L${g(1)} ${g(2)}`
      else if (c === "C") out += `C${g(1)} ${g(2)} ${g(3)} ${g(4)} ${g(5)} ${g(6)}`
      else if (c === "Q") {
        const x1 = x + (2 / 3) * (g(1) - x)
        const y1 = y + (2 / 3) * (g(2) - y)
        const x2 = g(3) + (2 / 3) * (g(1) - g(3))
        const y2 = g(4) + (2 / 3) * (g(2) - g(4))
        out += `C${x1} ${y1} ${x2} ${y2} ${g(3)} ${g(4)}`
      } else if (c === "Z") out += "Z"
    })
  return out
}

// the wasm module is loaded once per page; every later knob change re-renders through the same context
let bridge: Promise<typeof import("../wasm/gothic_vello.js")> | null = null
function vello() {
  bridge ??= (async () => {
    const mod = await import("../wasm/gothic_vello.js")
    await mod.default(wasmUrl)
    return mod
  })()
  return bridge
}

const INK: [number, number, number, number] = [226, 199, 122, 255]
const BG: [number, number, number, number] = [15, 17, 23, 255]
const SIZE = 720

type Receipt = { encode_ms: number; render_ms: number; strokes: number; adapter: string }

function VelloBody({ v }: { v: ValuesOf<AnySpec> }) {
  const p = v as Params
  const canvas = useRef<HTMLCanvasElement>(null)
  const status = useMemo(() => Signal<{ error: string; receipt: Receipt | null }>({ error: "", receipt: null }), [])
  const out = useMemo(() => generate(p, algoCtx(p, SIZE)), [p.scene, p.seed])
  const key = `${p.scene}|${p.seed}|${p.width}|${p.zoom}`

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const strokes = out.paths.map(path => ({
      d: toCubics(path.d),
      w: p.width * dpr,
      rgba: INK,
    }))
    el.width = SIZE * dpr
    el.height = SIZE * dpr
    let alive = true
    vello()
      .then(mod => {
        if (!alive) return
        return mod.render(el, { strokes, background: BG, width: el.width, height: el.height, zoom: p.zoom * dpr })
      })
      .then(receipt => {
        if (alive && receipt) status.$({ error: "", receipt: receipt as Receipt })
      })
      .catch((error: unknown) => {
        if (alive) status.$({ error: String((error as Error)?.message ?? error), receipt: null })
      })
    return () => {
      alive = false
    }
  }, [key])

  const state = status.$()
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div>
        <canvas
          ref={canvas}
          width={SIZE}
          height={SIZE}
          className="block h-auto w-full max-w-[720px] rounded-sm border border-[#35423e] bg-[#0f1117]"
          data-vello={p.scene}
        />
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[.16em] text-muted">
          {state.error
            ? `webgpu unavailable · ${state.error}`
            : state.receipt
              ? `${state.receipt.adapter} · encode ${state.receipt.encode_ms.toFixed(2)}ms · render ${state.receipt.render_ms.toFixed(2)}ms · ${state.receipt.strokes} strokes`
              : "compiling shaders…"}
        </p>
      </div>
      <div className="grid gap-3">
        <p className="text-[11px] leading-relaxed text-muted">
          the same generator paths, stroked by vello (Rust + wgpu) through WebGPU compute: the scene is encoded once,
          flattening, stroke expansion and rasterization all run on the GPU. The svg below is the CPU baseline.
        </p>
        <div className="w-[240px]">
          <AlgoSvg out={out} size={240} />
        </div>
        <span className="text-[10px] text-muted">svg baseline (browser stroke)</span>
      </div>
    </div>
  )
}

function NotebookPage(): ReactNode {
  return (
    <>
      <Section page="vello" def={{ id: "vello", title: "vello · GPU strokes", spec: ALGO.spec as unknown as AnySpec, presets: ALGO.presets as never }}>
        {v => <VelloBody v={v} />}
      </Section>
      {/* scaffold:sections */}
    </>
  )
}

export const PAGE: PageSpec = {
  id: "vello",
  title: "gothic: vello on webgpu",
  path: "/vello",
  specs: { vello: ALGO.spec as unknown as AnySpec },
  Component: NotebookPage,
}
