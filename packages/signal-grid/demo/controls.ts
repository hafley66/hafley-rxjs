// @comment-ok: the one-signal-per-control contract is the thing this file exists to hold, and the
// laziness note under `lens` is what keeps a bound panel gated behind `runWhenInView`
// Control primitives. Every one takes a signal and nothing else: the element shows what the signal
// holds, and a gesture on the element writes that same signal back.
//
// No control is ever told to re-read itself. Each hands back a `bind$` that paints the element for
// as long as something subscribes, so the page decides when a panel is live.
import { animationFrameScheduler, auditTime, EMPTY, map, merge, Observable, share, tap } from "rxjs"
import { Signal } from "@hafley66/signals"

export interface Bound {
  readonly el: HTMLElement
  /** Subscribing keeps `el` showing what its signal holds. The values it carries are not read. */
  readonly bind$: Observable<unknown>
}

export interface Option<T extends string> {
  readonly value: T
  readonly label: string
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (className !== undefined) el.className = className
  if (text !== undefined) el.textContent = text
  return el
}

export function must(selector: string): HTMLElement {
  const el = document.querySelector(selector)
  if (!(el instanceof HTMLElement)) throw new Error(`no element for ${selector}`)
  return el
}

/** A signal over a value that lives inside another one. `Signal(read)` holds no subscription on
 * anything `read` touches until it is subscribed, which keeps a bound panel gated by its host. */
export function lens<T>(read: () => T, write: (it: T) => void): Signal<T> {
  const view = Signal<T>(read)
  const node = {
    $: new Proxy(view.$, {
      apply: (target, _thisArg, args: readonly unknown[]) => {
        if (args.length === 0) return target()
        write(args[0] as T)
        return node
      },
    }),
  } as Signal<T>
  return node
}

const field = (label: string, control: HTMLElement, readout?: HTMLElement): HTMLElement => {
  const wrap = h("label", "field")
  const name = h("span", "field-label", label)
  wrap.append(name, control)
  if (readout !== undefined) {
    name.append(readout)
    readout.className = "field-value"
  }
  return wrap
}

/** A titled group. Groups keep a fixed order, and one subscription to the group paints every item. */
export function group(title: string, items: readonly Bound[]): Bound {
  const el = h("section", "group")
  const head = h("h2", "group-title", title)
  el.append(head)
  for (const item of items) el.append(item.el)
  return { el, bind$: merge(...items.map((it) => it.bind$)) }
}

export function selectField<T extends string>(
  label: string,
  options: readonly Option<T>[],
  value: Signal<T>,
): Bound {
  const el = h("select", "control control-select")
  for (const option of options) {
    const node = h("option", undefined, option.label)
    node.value = option.value
    el.append(node)
  }
  el.addEventListener("change", () => value.$(el.value as T))
  return { el: field(label, el), bind$: value.$.pipe(tap((it) => { el.value = it })) }
}

export function checkField(label: string, value: Signal<boolean>): Bound {
  const el = h("input", "control control-check")
  el.type = "checkbox"
  el.addEventListener("change", () => value.$(el.checked))
  const wrap = h("label", "field field-check")
  wrap.append(el, h("span", "field-label", label))
  return { el: wrap, bind$: value.$.pipe(tap((it) => { el.checked = it })) }
}

export function rangeField(
  label: string,
  bounds: { readonly min: number; readonly max: number; readonly step: number },
  value: Signal<number>,
  format: (it: number) => string = (it) => String(it),
): Bound {
  const el = h("input", "control control-range")
  el.type = "range"
  el.min = String(bounds.min)
  el.max = String(bounds.max)
  el.step = String(bounds.step)
  const readout = h("span")
  el.addEventListener("input", () => value.$(Number(el.value)))
  return {
    el: field(label, el, readout),
    bind$: value.$.pipe(
      tap((it) => {
        el.value = String(it)
        readout.textContent = format(it)
      }),
    ),
  }
}

export function numberField(
  label: string,
  bounds: { readonly min: number; readonly max: number; readonly step: number },
  value: Signal<number>,
): Bound {
  const el = h("input", "control control-number")
  el.type = "number"
  el.min = String(bounds.min)
  el.max = String(bounds.max)
  el.step = String(bounds.step)
  el.addEventListener("change", () => value.$(Number(el.value)))
  return { el: field(label, el), bind$: value.$.pipe(tap((it) => { el.value = String(it) })) }
}

export function textField(label: string, value: Signal<string>, placeholder?: string): Bound {
  const el = h("input", "control control-text")
  el.type = "text"
  if (placeholder !== undefined) el.placeholder = placeholder
  el.addEventListener("change", () => value.$(el.value))
  return {
    el: field(label, el),
    // A field being typed into is not painted over: the write happens on change, and clobbering the
    // caret mid-word is the one thing a live panel must not do.
    bind$: value.$.pipe(tap((it) => { if (document.activeElement !== el) el.value = it })),
  }
}

export function colorField(label: string, value: Signal<string>): Bound {
  const el = h("input", "control control-color")
  el.type = "color"
  el.addEventListener("input", () => value.$(el.value))
  return { el: field(label, el), bind$: value.$.pipe(tap((it) => { el.value = it })) }
}

/** Radio semantics without a radio group: `aria-pressed` is the state, the signal is the source. */
export function segmentField<T extends string>(
  label: string,
  options: readonly Option<T>[],
  value: Signal<T>,
): Bound {
  const el = h("div", "control control-segment")
  el.setAttribute("role", "group")
  const buttons = options.map((option) => {
    const button = h("button", "segment", option.label)
    button.type = "button"
    button.addEventListener("click", () => value.$(option.value))
    el.append(button)
    return { option, button }
  })
  return {
    el: field(label, el),
    bind$: value.$.pipe(
      tap((current) => {
        for (const entry of buttons) {
          entry.button.setAttribute("aria-pressed", String(entry.option.value === current))
        }
      }),
    ),
  }
}

export interface Action {
  readonly label: string
  readonly title?: string
  readonly run: () => void
}

/** Buttons hold no value, so there is nothing for them to show and nothing to bind. */
export function actions(items: readonly Action[]): Bound {
  const el = h("div", "control-actions")
  for (const item of items) {
    const button = h("button", "button", item.label)
    button.type = "button"
    if (item.title !== undefined) button.title = item.title
    button.addEventListener("click", item.run)
    el.append(button)
  }
  return { el, bind$: EMPTY }
}

/** A row of controls that belong to one column of the grid. Order is written by `applyOrder`. */
export interface Reorderable extends Bound {
  readonly key: string
}

/**
 * Reorders `host` to match `order` by moving elements, never rebuilding them, which is the same
 * trick the renderer plays on rows: a dragged handle keeps its focus and its pressed state.
 */
export function applyOrder(host: HTMLElement, order: readonly string[], items: readonly Reorderable[]): void {
  const rank = new Map(order.map((key, at) => [key, at] as const))
  const sorted = [...items].sort(
    (a, b) => (rank.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.key) ?? Number.MAX_SAFE_INTEGER),
  )
  let cursor: ChildNode | null = host.firstChild
  for (const item of sorted) {
    if (item.el === cursor) {
      cursor = cursor.nextSibling
      continue
    }
    host.insertBefore(item.el, cursor)
  }
}

/** Moves `key` to sit where `before` sits. Used by both the drag and the arrow buttons. */
export function moveBefore(order: readonly string[], key: string, before: string | null): readonly string[] {
  const without = order.filter((id) => id !== key)
  if (before === null) return [...without, key]
  const at = without.indexOf(before)
  if (at === -1) return [...without, key]
  return [...without.slice(0, at), key, ...without.slice(at)]
}

/** A label with a live value beside it. Shows a signal, writes nothing. */
export function readbackField(label: string, text: Signal<string>): Bound {
  const el = h("div", "field field-readback")
  const value = h("code", "readback")
  el.append(h("span", "field-label", label), value)
  return { el, bind$: text.$.pipe(tap((it) => { value.textContent = it })) }
}

/** An element whose attribute is a signal, for the parts of a panel that are not a labelled field. */
export function attributeOf(el: HTMLElement, name: string, value: Signal<string>): Bound {
  return { el, bind$: value.$.pipe(tap((it) => { el.setAttribute(name, it) })) }
}

/** One tick a frame after `source` emits, which is when the renderer has finished writing rows.
 * Shared, so a panel reading the document ten ways still costs one frame per burst. */
export const afterPaint = (source: Observable<unknown>): Observable<unknown> =>
  source.pipe(auditTime(0, animationFrameScheduler), share())

/** Text read out of the document rather than off state, sampled on each tick of `frames`. */
export const paintedText = (frames: Observable<unknown>, read: () => string): Signal<string> =>
  Signal<string>(frames.pipe(map(read)), "")
