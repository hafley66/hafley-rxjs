import { useEffect } from "react"

// draw-in: every path carries pathLength=1 and gets --i for the stagger; the keyframes live in kit.css
export function stagger(root: ParentNode | null, selector = "path"): number {
  if (!root) return 0
  let n = 0
  for (const svg of root.querySelectorAll("svg")) {
    let i = 0
    for (const e of svg.querySelectorAll<SVGElement>(selector)) e.style.setProperty("--i", String(i++))
    n += i
  }
  return n
}

// draw-in numbering after every render of the host
export function useDrawIn(ref: { current: HTMLElement | null }, deps: readonly unknown[]): void {
  useEffect(() => {
    stagger(ref.current)
  }, [ref, ...deps])
}

// mirrors an element's height into a :root custom property (sticky offsets read it)
export function useResizeVar(ref: { current: HTMLElement | null }, name: string): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty(name, `${el.offsetHeight}px`))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, name])
}

export const SIDE_MIN = 900
export const wideScreen = (): boolean => typeof matchMedia !== "function" || matchMedia(`(min-width: ${SIDE_MIN}px)`).matches

const SIDE_KEY = "kit.side"
// the knob sidebar is resized with the native resize handle; a manual width lands on :root (--kit-side) and in storage
export function useSideWidth(ref: { current: HTMLElement | null }): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const saved = localStorage.getItem(SIDE_KEY)
    if (saved) document.documentElement.style.setProperty("--kit-side", saved)
    const ro = new ResizeObserver(() => {
      if (!el.style.width) return
      document.documentElement.style.setProperty("--kit-side", el.style.width)
      localStorage.setItem(SIDE_KEY, el.style.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
}

const timelines = new Set<string>()
const VIEW_TIMELINES = typeof CSS !== "undefined" && CSS.supports("animation-timeline: view()")
let io: IntersectionObserver | null = null

// the anchor lights while its section intersects: a named view timeline, or IntersectionObserver where that is missing
export function useAnchor(id: string, ref: { current: HTMLElement | null }): void {
  useEffect(() => {
    const sec = ref.current
    const a = document.querySelector<HTMLAnchorElement>(`[data-anchor="${CSS.escape(id)}"]`)
    if (!sec || !a) return
    const name = `--kit-tl-${id.replace(/[^a-z0-9_-]/gi, "_")}`
    if (VIEW_TIMELINES) {
      timelines.add(name)
      sec.style.setProperty("view-timeline-name", name)
      a.style.setProperty("animation-timeline", name)
      document.body.style.setProperty("timeline-scope", [...timelines].join(", "))
      return () => {
        timelines.delete(name)
        sec.style.removeProperty("view-timeline-name")
        document.body.style.setProperty("timeline-scope", [...timelines].join(", "))
      }
    }
    io ??= new IntersectionObserver(
      entries => {
        for (const e of entries) {
          const link = document.querySelector<HTMLAnchorElement>(`[data-anchor="${CSS.escape(e.target.id)}"]`)
          if (link) link.toggleAttribute("data-active", e.isIntersecting)
        }
      },
      { rootMargin: "-10% 0px -10% 0px" },
    )
    io.observe(sec)
    return () => io?.unobserve(sec)
  }, [id, ref])
}
