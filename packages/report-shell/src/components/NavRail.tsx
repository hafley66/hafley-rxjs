// Chevron toggle placed at the top of a consumer's <nav>, beside its TreeTable: same shape as the
// `gutter` div, not a tree prop, since the tree never sees a track signal.
import { useEffect, useMemo, useRef } from 'react'
import { SignalReact } from '@hafley66/signals/react'
import type { Signal as SignalType, Storage } from '@hafley66/signals'
import { createNavCollapse } from '../lib/navCollapse'

export type NavRailProps = {
  track: SignalType<number>
  storage: Storage<string>
  expandedFallback: number
}

function NavRailView({ track, storage, expandedFallback }: NavRailProps) {
  const nav = useMemo(() => createNavCollapse(track, storage, expandedFallback), [track, storage, expandedFallback])
  const collapsed = nav.collapsed.$()
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const navEl = buttonRef.current?.closest('nav')
    if (navEl) navEl.dataset.navCollapsed = String(collapsed)
  }, [collapsed])

  return (
    <button
      ref={buttonRef}
      type="button"
      className="nav-rail-toggle"
      data-testid="nav-rail-toggle"
      title={collapsed ? 'expand nav' : 'collapse nav'}
      aria-expanded={!collapsed}
      onClick={nav.toggle}
    >
      {collapsed ? '»' : '«'}
    </button>
  )
}

export const NavRail = SignalReact(NavRailView)
