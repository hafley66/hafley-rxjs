// Any label that may overflow renders through this: hovering opens a native `popover=hint`
// anchored to it with the full text and a copy button; a fitting label never opens anything.
import { useId, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'

const OPEN_DELAY_MS = 180
const CLOSE_GRACE_MS = 220

function supportedPopoverValue(): 'hint' | 'auto' {
  const probe = document.createElement('div') as HTMLDivElement & { popover?: string }
  probe.setAttribute('popover', 'hint')
  return probe.popover === 'hint' ? 'hint' : 'auto'
}

function overflows(el: HTMLElement, text: string): boolean {
  return text.includes('\n') || el.scrollWidth > el.clientWidth + 1
}

export function Truncated({ text, className = '' }: { text: string; className?: string }) {
  const id = useId().replace(/:/g, '')
  const anchorId = `truncated-anchor-${id}`
  const popoverId = `truncated-popover-${id}`
  const anchorRef = useRef<HTMLSpanElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const popoverValue = useRef(supportedPopoverValue())

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  const show = () => {
    clearTimer()
    const popover = popoverRef.current
    if (popover && !popover.matches(':popover-open')) popover.showPopover()
  }
  const hideSoon = () => {
    clearTimer()
    timer.current = setTimeout(() => popoverRef.current?.hidePopover(), CLOSE_GRACE_MS)
  }
  const onAnchorEnter = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!overflows(event.currentTarget, text)) return
    clearTimer()
    timer.current = setTimeout(show, OPEN_DELAY_MS)
  }
  const onAnchorClick = (event: ReactPointerEvent<HTMLSpanElement> | React.MouseEvent<HTMLSpanElement>) => {
    if (overflows(event.currentTarget, text)) show()
  }
  const onCopy = () => navigator.clipboard?.writeText(text)

  return (
    <>
      <span
        ref={anchorRef}
        className={`truncated-anchor ${className}`.trim()}
        id={anchorId}
        style={{ anchorName: `--${anchorId}` } as CSSProperties}
        onPointerEnter={onAnchorEnter}
        onPointerLeave={hideSoon}
        onClick={onAnchorClick}
      >
        {text}
      </span>
      <div
        ref={popoverRef}
        id={popoverId}
        className="popover truncated-popover"
        popover={popoverValue.current}
        style={{ positionAnchor: `--${anchorId}` } as CSSProperties}
        onPointerEnter={clearTimer}
        onPointerLeave={hideSoon}
      >
        <button type="button" className="popover-close" popoverTarget={popoverId} popoverTargetAction="hide" title="close">×</button>
        <button type="button" className="truncated-copy" onClick={onCopy} title="copy">copy</button>
        <pre className="truncated-text">{text}</pre>
      </div>
    </>
  )
}
