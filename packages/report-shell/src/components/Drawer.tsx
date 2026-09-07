import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { useResizeVar } from "../lib/hooks.js"

export const DRAWER_BODY_ID = "kit-panels"

export type DrawerProps = {
  summary?: ReactNode
  pageKey: string
  open?: boolean
  tag?: string
  title?: string
}

// sticky <details> under the tabs: folds to its summary line, opens to every panel portaled into its body;
// the body is keyed by page so panels re-attach on a route change; its height lands in --kit-drawer
export function Drawer({ summary, pageKey, open = true, tag = "knobs", title }: DrawerProps): ReactNode {
  const ref = useRef<HTMLDetailsElement>(null)
  useResizeVar(ref, "--kit-drawer")
  return (
    <details className="kit-drawer" ref={ref} open={open}>
      <summary title={title ?? "every knob of this page; click to fold the drawer"}>
        <span className="kit-drawer-tag">{tag}</span>
        {summary}
      </summary>
      <div id={DRAWER_BODY_ID} className="kit-panels" key={pageKey} />
    </details>
  )
}

// the drawer body exists before any section mounts; sections read it in an effect so panels land in section order
export function useDrawerBody(): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => setEl(document.getElementById(DRAWER_BODY_ID)), [])
  return el
}
