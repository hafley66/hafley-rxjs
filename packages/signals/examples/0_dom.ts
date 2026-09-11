// Four builders, so an example's displayed source is about signals rather than about elements.
// A readout carries `data-read`, which is the selector the example check counts as painted.

export function panel(host: HTMLElement): HTMLElement {
  const root = document.createElement("div")
  root.className = "sx-panel"
  host.append(root)
  return root
}

export function row(into: HTMLElement): HTMLElement {
  const line = document.createElement("div")
  line.className = "sx-row"
  into.append(line)
  return line
}

export function button(label: string, into: HTMLElement): HTMLButtonElement {
  const node = document.createElement("button")
  node.type = "button"
  node.className = "sx-button"
  node.textContent = label
  into.append(node)
  return node
}

/** A labelled value the example writes into. `write` is the only thing an effect has to call. */
export function readout(label: string, into: HTMLElement): { readonly write: (text: string) => void } {
  const wrap = document.createElement("div")
  wrap.className = "sx-readout"
  wrap.dataset.read = label
  const name = document.createElement("span")
  name.className = "sx-label"
  name.textContent = label
  const value = document.createElement("code")
  value.className = "sx-value"
  wrap.append(name, value)
  into.append(wrap)
  return {
    write: (text) => {
      value.textContent = text
    },
  }
}

/** An input a reader types into, for the examples whose subject is what arrives over time. */
export function field(placeholder: string, into: HTMLElement): HTMLInputElement {
  const node = document.createElement("input")
  node.type = "text"
  node.className = "sx-field"
  node.placeholder = placeholder
  into.append(node)
  return node
}
