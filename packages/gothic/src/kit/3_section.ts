import { Signal } from "@hafley66/signals"
import {
  type AnySpec,
  PIN_SPEC,
  type PinValues,
  type Presets,
  type ValuesOf,
  defaultsOf,
  parseValues,
} from "./0_spec.js"
import { bindUrl, commit, readUrl } from "./1_url.js"
import { bar, inputId } from "./2_bar.js"
import { currentPin, store } from "./6_store.js"
import "./kit.css"

// sections: the anchors a page registers, shown as the link's hover list so the header says what each page has
export type Link = { id: string; href: string; legacy?: boolean; sections?: readonly string[] }
export type PageOpts = { id: string; title?: string; links?: readonly Link[]; storage?: string }
export type Page = {
  id: string
  header: HTMLElement
  nav: HTMLElement
  sections: HTMLElement
  main: HTMLElement
  storage: string
  zDepth(): number
}

const ZSPEC = {
  z: { kind: "range", min: 0, max: 1, step: 0.05, default: 0, label: "zDepth", static: true },
} as const satisfies AnySpec
let current: Page | null = null
let zCell: Signal<ValuesOf<typeof ZSPEC>> | null = null
const depthListeners = new Set<() => void>()

export function applyDepth(root: ParentNode): void {
  for (const e of root.querySelectorAll<HTMLElement>("[data-z]")) e.style.setProperty("--z", e.dataset.z ?? "0")
}

// header = notebook links + section anchors; --kit-top tracks its height so section bars stick under it
export function page(o: PageOpts): Page {
  if (current) return current
  const header = document.createElement("header")
  header.className = "kit-top"
  header.innerHTML = `<b>${o.title ?? document.title}</b><nav></nav><span class="kit-sections"></span>`
  const nav = header.querySelector("nav") as HTMLElement
  for (const l of o.links ?? []) {
    const a = document.createElement("a")
    a.href = l.href
    a.textContent = l.legacy ? `${l.id}*` : l.id
    if (l.sections?.length) a.title = l.sections.join(" · ")
    if (l.id === o.id) a.setAttribute("aria-current", "page")
    nav.append(a)
  }
  const main = document.createElement("main")
  document.body.prepend(header, main)
  new ResizeObserver(() => document.documentElement.style.setProperty("--kit-top", `${header.offsetHeight}px`)).observe(
    header,
  )
  current = {
    id: o.id,
    header,
    nav,
    sections: header.querySelector(".kit-sections") as HTMLElement,
    main,
    storage: `${o.storage ?? "kit"}.${o.id}`,
    zDepth: () => zCell?.$().z ?? 0,
  }
  return current
}

// section anchors light up while their section intersects the viewport: a named view timeline on the section drives
// an animation on the header anchor; timeline-scope on <body> makes the name visible outside the section (skill gotcha)
const timelines: string[] = []
const VIEW_TIMELINES = typeof CSS !== "undefined" && CSS.supports("animation-timeline: view()")
let io: IntersectionObserver | null = null
function trackAnchor(sec: HTMLElement, a: HTMLAnchorElement): void {
  const name = `--kit-tl-${sec.id.replace(/[^a-z0-9_-]/gi, "_")}`
  timelines.push(name)
  if (VIEW_TIMELINES) {
    sec.style.setProperty("view-timeline-name", name)
    a.style.setProperty("animation-timeline", name)
    document.body.style.setProperty("timeline-scope", timelines.join(", "))
    return
  }
  io ??= new IntersectionObserver(
    entries => {
      for (const e of entries) {
        const link = document.querySelector<HTMLAnchorElement>(`.kit-sections a[href="#${e.target.id}"]`)
        if (link) link.toggleAttribute("data-active", e.isIntersecting)
      }
    },
    { rootMargin: "-10% 0px -10% 0px" },
  )
  io.observe(sec)
}

// legacy single-file notebooks: same header, anchors from their own <section id> elements, sticky offset via --kit-top
export function legacyPage(o: PageOpts, selector = "main > section[id]"): Page {
  const pg = page(o)
  for (const sec of document.querySelectorAll<HTMLElement>(selector)) {
    const a = document.createElement("a")
    a.href = `#${sec.id}`
    a.textContent = sec.id.replace(/-s$/, "")
    pg.sections.append(a)
    trackAnchor(sec, a)
  }
  pg.main.remove()
  return pg
}

function ensureZ(): void {
  if (zCell || !current) return
  zCell = Signal<ValuesOf<typeof ZSPEC>>(readUrl("page", ZSPEC))
  bindUrl("page", ZSPEC, zCell as never)
  const label = document.createElement("label")
  label.innerHTML = `zDepth <input id="${inputId("page", "z")}" type="range" min="0" max="1" step="0.05">`
  const input = label.querySelector("input") as HTMLInputElement
  input.addEventListener("input", () => commit("replace", () => zCell?.$({ z: Number(input.value) })))
  current.header.append(label)
  zCell.$.subscribe(v => {
    input.value = String(v.z)
    document.documentElement.style.setProperty("--kit-zdepth", String(v.z))
    for (const fn of depthListeners) fn()
  })
}

export type Ctx<S extends AnySpec> = {
  first: boolean
  changed: Set<keyof S & string>
  extra: HTMLElement
  values: Signal<ValuesOf<S>>
  zDepth: number
}
export type SectionOpts<S extends AnySpec> = {
  id: string
  title: string
  spec: S
  presets?: Presets<ValuesOf<S>>
  zDepth?: boolean
  render(values: ValuesOf<S>, host: HTMLElement, ctx: Ctx<S>): void
}
export type Section<S extends AnySpec> = {
  id: string
  el: HTMLElement
  host: HTMLElement
  values: Signal<ValuesOf<S>>
  pins: Signal<PinValues>
  rerender(): void
}

// one section = one URL namespace (?<id>.<key>=, ?<id>.pin=), one sticky bar, one nav anchor; render runs on every value change.
// start values: defaults, then the localStorage autosave, then the URL (URL wins)
export function section<S extends AnySpec>(o: SectionOpts<S>): Section<S> {
  const pg = page({ id: o.id })
  const st = store(`${pg.storage}.${o.id}`)
  const fromUrl = readUrl(o.id, o.spec)
  const urlKeys = new Set(new URLSearchParams(location.search).keys())
  const saved = parseValues(o.spec, st.current() ?? {})
  const start = { ...defaultsOf(o.spec), ...saved } as ValuesOf<S>
  for (const k of Object.keys(o.spec) as (keyof S & string)[]) if (urlKeys.has(`${o.id}.${k}`)) start[k] = fromUrl[k]
  const values = Signal<ValuesOf<S>>(start)
  const pins = Signal<PinValues>(
    urlKeys.has(`${o.id}.pin`) ? readUrl(o.id, PIN_SPEC) : { pin: currentPin(`${pg.storage}.${o.id}`) },
  )
  bindUrl(o.id, o.spec, values as never)
  bindUrl(o.id, PIN_SPEC, pins as never, `${o.id}#pin`)
  const el = document.createElement("section")
  el.className = "kit-section"
  el.id = o.id
  const { extra } = bar(el, { id: o.id, spec: o.spec, values, pins, store: st, presets: o.presets, title: o.title })
  const host = document.createElement("div")
  host.className = "kit-host"
  el.append(host)
  pg.main.append(el)
  const a = document.createElement("a")
  a.href = `#${o.id}`
  a.textContent = o.id
  pg.sections.append(a)
  trackAnchor(el, a)
  if (o.zDepth) ensureZ()

  let prev: ValuesOf<S> | null = null
  const draw = (v: ValuesOf<S>, changed: Set<keyof S & string>) => {
    const top = el.getBoundingClientRect().top + scrollY
    const h = el.offsetHeight
    const frac = h && scrollY > top ? (scrollY - top) / h : 0
    o.render(v, host, { first: prev === null, changed, extra, values, zDepth: pg.zDepth() })
    applyDepth(host)
    if (frac > 0) scrollTo(0, top + frac * el.offsetHeight)
    prev = v
  }
  values.$.subscribe(v => {
    st.saveCurrent(v, pins.$().pin)
    const changed = new Set<keyof S & string>()
    for (const k of Object.keys(o.spec) as (keyof S & string)[]) if (!prev || prev[k] !== v[k]) changed.add(k)
    if (prev && changed.size === 0) return
    draw(v, changed)
  })
  pins.$.subscribe(p => st.saveCurrent(values.$(), p.pin))
  const rerender = () => draw(values.$(), new Set())
  if (o.zDepth) depthListeners.add(() => prev && rerender())
  return { id: o.id, el, host, values, pins, rerender }
}
