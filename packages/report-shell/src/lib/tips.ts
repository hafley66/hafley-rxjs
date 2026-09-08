// enableTips(): document-delegated hover tooltips over any titled element; the native title lifts while
// hovered and restores on leave. A popover=hint bubble, non-interactive; anchor-positioned where supported.
const OPEN_DELAY_MS = 140

function supportedPopoverValue(): "hint" | "auto" {
  if (typeof document === "undefined") return "auto"
  const probe = document.createElement("div") as HTMLDivElement & { popover?: string }
  probe.setAttribute("popover", "hint")
  return probe.popover === "hint" ? "hint" : "auto"
}

export function enableTips(): () => void {
  if (typeof document === "undefined") return () => {}
  const tip = document.createElement("div")
  const native = typeof tip.showPopover === "function"
  tip.className = "kit-tip"
  if (native) tip.setAttribute("popover", supportedPopoverValue())
  tip.setAttribute("aria-hidden", "true")
  if (!native) tip.hidden = true
  document.body.append(tip)
  const anchored = typeof CSS !== "undefined" && CSS.supports("anchor-name: --kit-tip-a")
  let current: HTMLElement | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let serial = 0

  const restore = () => {
    if (current?.dataset.tipText) current.setAttribute("title", current.dataset.tipText)
    current = null
  }
  const hide = () => {
    if (timer) clearTimeout(timer)
    timer = null
    if (native) tip.hidePopover()
    else tip.hidden = true
    tip.textContent = ""
    restore()
  }
  const placeFallback = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    const x = Math.min(Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2), innerWidth - tip.offsetWidth - 8)
    const y = r.top - tip.offsetHeight - 6 >= 8 ? r.top - tip.offsetHeight - 6 : r.bottom + 6
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
  }
  const show = (el: HTMLElement) => {
    const text = el.dataset.tipText ?? el.getAttribute("title") ?? ""
    if (!text.trim()) return
    if (current !== el) {
      restore()
      current = el
      el.dataset.tipText = text
      el.removeAttribute("title")
      if (anchored) {
        const name = `--kit-tip-${++serial}`
        el.style.anchorName = name
        tip.style.positionAnchor = name
      }
    }
    tip.textContent = text
    if (native) tip.showPopover()
    else tip.hidden = false
    if (!anchored) placeFallback(el)
  }
  const onOver = (event: Event) => {
    const el = (event.target as HTMLElement | null)?.closest?.("[title]") as HTMLElement | null
    if (!el || el.contains(tip)) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => show(el), OPEN_DELAY_MS)
  }
  const onOut = (event: Event) => {
    const to = (event as PointerEvent).relatedTarget as Node | null
    if (current?.contains(to ?? null) || tip.contains(to ?? null)) return
    hide()
  }
  const onMove = () => {
    if (current && !anchored) placeFallback(current)
  }
  document.addEventListener("pointerover", onOver)
  document.addEventListener("pointerout", onOut)
  addEventListener("scroll", onMove, true)
  addEventListener("resize", onMove)
  return () => {
    hide()
    tip.remove()
    document.removeEventListener("pointerover", onOver)
    document.removeEventListener("pointerout", onOut)
    removeEventListener("scroll", onMove, true)
    removeEventListener("resize", onMove)
  }
}
