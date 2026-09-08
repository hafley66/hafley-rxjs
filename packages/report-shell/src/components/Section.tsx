import { SignalReact } from "@hafley66/signals/react"
import { type ReactNode, useLayoutEffect, useRef } from "react"
import { useAnchor } from "../lib/hooks.js"
import type { AnySpec, Presets, ValuesOf } from "../spec/0_spec.js"
import type { SectionState, Sections } from "../spec/3_sections.js"
import { SpecPanel, type SpecPanelProps } from "./SpecPanel.js"

export type SectionDef<S extends AnySpec> = {
  id: string
  title: string
  spec: S
  presets?: Presets<ValuesOf<S>>
}
export type SectionCtx<S extends AnySpec> = { state: SectionState<S> }

type ShellProps = {
  sections: Sections
  page: string
  def: SectionDef<AnySpec>
  extra?: ReactNode
  fieldSettings?: SpecPanelProps["fieldSettings"]
  open?: boolean
  render: (v: ValuesOf<AnySpec>, ctx: SectionCtx<AnySpec>) => ReactNode
}

const safe = (id: string) => id.replace(/[^a-z0-9_-]/gi, "_")

const Shell = SignalReact(function Shell({ sections, page, def, extra, fieldSettings, open = true, render }: ShellProps) {
  const state = sections.sectionState(page, def.id, def.spec, def.presets)
  const values = state.values.$()
  const ref = useRef<HTMLElement>(null)
  const keep = useRef(0)
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
    <section id={def.id} ref={ref} className="kit-section">
      <details className="kit-drawer" open={open}>
        <summary title={`${def.title}: every knob of this section; click to fold`}>
          <span className="kit-drawer-icon" aria-hidden />
          <h2 className="kit-sec-title">{def.title}</h2>
        </summary>
        <div className="kit-panels">
          <SpecPanel state={state} extra={extra} fieldSettings={fieldSettings} />
        </div>
      </details>
      <div className="kit-host" style={{ viewTransitionName: `sec-${safe(def.id)}` }}>
        {render(values, { state })}
      </div>
    </section>
  )
})

export type SectionProps<S extends AnySpec> = {
  sections: Sections
  page: string
  def: SectionDef<S>
  extra?: ReactNode
  fieldSettings?: SpecPanelProps["fieldSettings"]
  // the knob drawer starts open unless told otherwise
  open?: boolean
  children: (v: ValuesOf<S>, ctx: SectionCtx<AnySpec>) => ReactNode
}

// one url namespace + one storage key + one sticky knob drawer whose summary is the section title; the body renders from the live values
export function Section<S extends AnySpec>(props: SectionProps<S>): ReactNode {
  return (
    <Shell
      sections={props.sections}
      page={props.page}
      def={props.def as unknown as SectionDef<AnySpec>}
      extra={props.extra}
      fieldSettings={props.fieldSettings}
      open={props.open}
      render={props.children as never}
    />
  )
}

// tail sections without a panel: the anchor and the view timeline still work
export function PlainSection({ id, title, children }: { id: string; title: string; children: ReactNode }): ReactNode {
  const ref = useRef<HTMLElement>(null)
  useAnchor(id, ref)
  return (
    <section id={id} ref={ref} className="kit-section">
      <h2 className="kit-sec-title">{title}</h2>
      <div className="kit-host" style={{ viewTransitionName: `sec-${safe(id)}` }}>
        {children}
      </div>
    </section>
  )
}
