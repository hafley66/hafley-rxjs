// Gear button + popover shell shared by every menu: native `popover` attribute and CSS anchor
// positioning handle open/close and placement, no JS state.
import type { ReactNode } from 'react'

export function GearButton({ id, popoverTargetId, label, title, className = 'gear-button' }: {
  id: string
  popoverTargetId: string
  label: ReactNode
  title?: string
  className?: string
}) {
  return (
    <button type="button" id={id} className={className} title={title} popoverTarget={popoverTargetId}>
      {label}
    </button>
  )
}

export function PopoverPanel({ id, className = '', children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <div id={id} className={`popover ${className}`.trim()} popover="auto">
      <button type="button" className="popover-close" popoverTarget={id} popoverTargetAction="hide" title="close">×</button>
      {children}
    </div>
  )
}
