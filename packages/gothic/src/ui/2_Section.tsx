import type { AnySpec, Presets, ValuesOf } from "@hafley66/report-shell"
import { SignalReact } from "@hafley66/signals/react"
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { type SectionState, sectionState, zDepth } from "../app/2_state.js"
import { useAnchor } from "./0_hooks.js"
import { Bar } from "./1_Bar.js"

export type SectionDef<S extends AnySpec> = {
  id: string
  title: string
  spec: S
  presets?: Presets<ValuesOf<S>>
  zDepth?: boolean
}
export type SectionCtx<S extends AnySpec> = { z: number; state: SectionState<S> }

type ShellProps = {
  page: string
  def: SectionDef<AnySpec>
  extra?: ReactNode
  render: (v: ValuesOf<AnySpec>, ctx: SectionCtx<AnySpec>) => ReactNode
}

const safe = (id: string) => id.replace(/[^a-z0-9_-]/gi, "_")

// the drawer body is rendered by App before any section mounts; panels portal into it in section order
export const RAIL_ID = "kit-panels"
function useRail(): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => setEl(document.getElementById(RAIL_ID)), [])
  return el
}

const Shell = SignalReact(function Shell({ page, def, extra, render }: ShellProps) {
  const state = sectionState(page, def.id, def.spec, def.presets)
  const values = state.values.$()
  const z = def.zDepth ? zDepth() : 0
  const ref = useRef<HTMLElement>(null)
  const keep = useRef(0)
  const rail = useRail()
  useAnchor(def.id, ref)

  // the section's own scroll fraction, measured before this render lands, restored after it
  const el = ref.current
  if (el) {
    const top = el.getBoundingClientRect().top + scrollY
    const h = el.offsetHeight
    keep.current = h && scrollY > top ? (scrollY - top) / h : 0
  }
  useLayoutEffect(() => {
    const node = ref.current
    if (!node || keep.current <= 0) return
    scrollTo(0, node.getBoundingClientRect().top + scrollY + keep.current * node.offsetHeight)
  })

  return (
    <section id={def.id} ref={ref} className="kit-section grid gap-3">
      {rail && createPortal(<Bar state={state} title={def.title} extra={extra} />, rail)}
      <h2 className="kit-sec-title">{def.title}</h2>
      <div className="kit-host grid gap-5 px-4 pb-4" style={{ viewTransitionName: `sec-${safe(def.id)}` }}>
        {render(values, { z, state })}
      </div>
    </section>
  )
})

export function Section<S extends AnySpec>(props: {
  page: string
  def: SectionDef<S>
  extra?: ReactNode
  children: (v: ValuesOf<S>, ctx: SectionCtx<AnySpec>) => ReactNode
}): ReactNode {
  return (
    <Shell
      page={props.page}
      def={props.def as unknown as SectionDef<AnySpec>}
      extra={props.extra}
      render={props.children as never}
    />
  )
}

// tail sections without a bar: the anchor and the view timeline still work
export function PlainSection({ id, title, children }: { id: string; title: string; children: ReactNode }): ReactNode {
  const ref = useRef<HTMLElement>(null)
  useAnchor(id, ref)
  return (
    <section id={id} ref={ref} className="kit-section grid gap-3">
      <h2 className="kit-sec-title">{title}</h2>
      <div className="kit-host grid gap-5 px-4 pb-4" style={{ viewTransitionName: `sec-${safe(id)}` }}>
        {children}
      </div>
    </section>
  )
}
