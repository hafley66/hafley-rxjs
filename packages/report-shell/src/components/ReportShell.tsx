import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { localStorageAdapter, type Signal as SignalType } from '@hafley66/signals'
import { gutter, layout, type Track } from '../layout'
import { NavRail } from './NavRail'

export type ReportTracks = Record<string, SignalType<number>>

export type ReportShellProps = {
  // Must include a track named "nav" (axis x); its fallback is the expanded nav width.
  tracks: Track[]
  // localStorage keys: `${storageKey}.tracks`, `${storageKey}.nav-collapsed`
  storageKey: string
  header: ReactNode
  nav: ReactNode
  children: (tracks: ReportTracks) => ReactNode
  onInteract?: () => void
}

// header / nav (rail + content + drag gutter) / main. Track px land on --track-<name> CSS vars.
export function ReportShell({ tracks: trackDefs, storageKey, header, nav, children, onInteract }: ReportShellProps) {
  const navGutterRef = useRef<HTMLDivElement>(null)
  const tracks = useMemo(() => layout(document.documentElement, trackDefs, localStorageAdapter(`${storageKey}.tracks`)), [trackDefs, storageKey])
  const navCollapseStorage = useMemo(() => localStorageAdapter(`${storageKey}.nav-collapsed`), [storageKey])
  const navFallback = trackDefs.find((t) => t.name === 'nav')?.fallback ?? 380

  useEffect(() => {
    if (!navGutterRef.current || !tracks.nav) return
    return gutter(navGutterRef.current, tracks.nav, { axis: 'x' })
  }, [tracks])

  return (
    <>
      {header}
      <nav onClickCapture={onInteract}>
        <NavRail track={tracks.nav!} storage={navCollapseStorage} expandedFallback={navFallback} />
        {nav}
        <div ref={navGutterRef} className="gutter gutter-x" data-testid="nav-gutter" />
      </nav>
      <main onClickCapture={onInteract}>{children(tracks)}</main>
    </>
  )
}
