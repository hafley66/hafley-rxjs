// hover tooltips: one fixed bubble shows any titled control's text on hover, including row labels
// the bubble is pointer-events:none with no controls inside; the native title hides while hovered, then restores
export function enableTips(): () => void {
  if (typeof document === "undefined") return () => {}
  const tip = document.createElement("div")
  tip.className = "kit-tip"
  tip.setAttribute("aria-hidden", "true")
  document.body.append(tip)
  let current: HTMLElement | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const restore = () => {
    if (current?.dataset.tipText) current.setAttribute("title", current.dataset.tipText)
    current = null
  }
  const hide = () => {
    if (timer) clearTimeout(timer)
    timer = null
    delete tip.dataset.show
    tip.textContent = ""
    restore()
  }
  const place = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    const w = tip.offsetWidth
    const h = tip.offsetHeight
    const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8)
    const y = r.top - h - 6 >= 8 ? r.top - h - 6 : r.bottom + 6
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
    }
    tip.textContent = text
    tip.dataset.show = ""
    place(el)
  }
  const onOver = (event: Event) => {
    const target = event.target as HTMLElement | null
    const el = target?.closest?.("[title], [data-tip-text]") as HTMLElement | null
    if (!el) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => show(el), 140)
  }
  const onOut = (event: Event) => {
    const to = (event as PointerEvent).relatedTarget as Node | null
    if (current?.contains(to ?? null)) return
    hide()
  }
  const onScroll = () => {
    if (current) place(current)
  }
  document.addEventListener("pointerover", onOver)
  document.addEventListener("pointerout", onOut)
  addEventListener("scroll", onScroll, true)
  addEventListener("resize", onScroll)
  return () => {
    hide()
    tip.remove()
    document.removeEventListener("pointerover", onOver)
    document.removeEventListener("pointerout", onOut)
    removeEventListener("scroll", onScroll, true)
    removeEventListener("resize", onScroll)
  }
}
