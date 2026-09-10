// Control primitives. Every one of them is a lens over a signal: `read` pulls the current value out
// of grid state, `write` puts one back, and `refresh` is called after any state emission so a
// control moved from the console lands in the panel too.
//
// No local component state exists in this file. That is the point being demonstrated:
// the input element is a view of the signal, not a second copy of it.

export interface Bound {
  readonly el: HTMLElement
  readonly refresh: () => void
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

/** A titled group. Groups keep a fixed order so a refresh never reflows the panel. */
export function group(title: string, items: readonly Bound[]): Bound {
  const el = h("section", "group")
  const head = h("h2", "group-title", title)
  el.append(head)
  for (const item of items) el.append(item.el)
  return { el, refresh: () => { for (const item of items) item.refresh() } }
}

export function selectField<T extends string>(
  label: string,
  options: readonly Option<T>[],
  read: () => T,
  write: (next: T) => void,
): Bound {
  const el = h("select", "control control-select")
  for (const option of options) {
    const node = h("option", undefined, option.label)
    node.value = option.value
    el.append(node)
  }
  el.addEventListener("change", () => write(el.value as T))
  return { el: field(label, el), refresh: () => { el.value = read() } }
}

export function checkField(label: string, read: () => boolean, write: (next: boolean) => void): Bound {
  const el = h("input", "control control-check")
  el.type = "checkbox"
  el.addEventListener("change", () => write(el.checked))
  const wrap = h("label", "field field-check")
  wrap.append(el, h("span", "field-label", label))
  return { el: wrap, refresh: () => { el.checked = read() } }
}

export function rangeField(
  label: string,
  bounds: { readonly min: number; readonly max: number; readonly step: number },
  read: () => number,
  write: (next: number) => void,
  format: (value: number) => string = (value) => String(value),
): Bound {
  const el = h("input", "control control-range")
  el.type = "range"
  el.min = String(bounds.min)
  el.max = String(bounds.max)
  el.step = String(bounds.step)
  const readout = h("span")
  el.addEventListener("input", () => write(Number(el.value)))
  return {
    el: field(label, el, readout),
    refresh: () => {
      const value = read()
      el.value = String(value)
      readout.textContent = format(value)
    },
  }
}

export function numberField(
  label: string,
  bounds: { readonly min: number; readonly max: number; readonly step: number },
  read: () => number,
  write: (next: number) => void,
): Bound {
  const el = h("input", "control control-number")
  el.type = "number"
  el.min = String(bounds.min)
  el.max = String(bounds.max)
  el.step = String(bounds.step)
  el.addEventListener("change", () => write(Number(el.value)))
  return { el: field(label, el), refresh: () => { el.value = String(read()) } }
}

export function textField(
  label: string,
  read: () => string,
  write: (next: string) => void,
  placeholder?: string,
): Bound {
  const el = h("input", "control control-text")
  el.type = "text"
  if (placeholder !== undefined) el.placeholder = placeholder
  el.addEventListener("change", () => write(el.value))
  return {
    el: field(label, el),
    // A field being typed into is not re-read: the state write happens on change, and clobbering
    // the caret mid-word is the one thing a live panel must not do.
    refresh: () => { if (document.activeElement !== el) el.value = read() },
  }
}

export function colorField(label: string, read: () => string, write: (next: string) => void): Bound {
  const el = h("input", "control control-color")
  el.type = "color"
  el.addEventListener("input", () => write(el.value))
  return { el: field(label, el), refresh: () => { el.value = read() } }
}

/** Radio semantics without a radio group: `aria-pressed` is the state, the signal is the source. */
export function segmentField<T extends string>(
  label: string,
  options: readonly Option<T>[],
  read: () => T,
  write: (next: T) => void,
): Bound {
  const el = h("div", "control control-segment")
  el.setAttribute("role", "group")
  const buttons = options.map((option) => {
    const button = h("button", "segment", option.label)
    button.type = "button"
    button.addEventListener("click", () => write(option.value))
    el.append(button)
    return { option, button }
  })
  return {
    el: field(label, el),
    refresh: () => {
      const current = read()
      for (const entry of buttons) {
        entry.button.setAttribute("aria-pressed", String(entry.option.value === current))
      }
    },
  }
}

export interface Action {
  readonly label: string
  readonly title?: string
  readonly run: () => void
}

export function actions(items: readonly Action[]): Bound {
  const el = h("div", "control-actions")
  for (const item of items) {
    const button = h("button", "button", item.label)
    button.type = "button"
    if (item.title !== undefined) button.title = item.title
    button.addEventListener("click", item.run)
    el.append(button)
  }
  return { el, refresh: () => {} }
}

/** A row of controls that belong to one column of the grid. Order is set by `refresh`. */
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

/** A label with a live value beside it. Reads state, writes nothing. */
export function readbackField(label: string, read: () => string): Bound {
  const el = h("div", "field field-readback")
  const value = h("code", "readback")
  el.append(h("span", "field-label", label), value)
  return { el, refresh: () => { value.textContent = read() } }
}
