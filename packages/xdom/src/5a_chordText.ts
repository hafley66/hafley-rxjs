// Human text for a chord spec, for notices and tooltips. Reads the keyboard specs `parseChord`
// reads ("Mod+K", "Shift+ArrowDown", "Escape") plus the pointer parts `Click`, `RightClick`
// and `Wheel`, which no KeyboardEvent carries.

const MAC_MODIFIERS: Record<string, string> = { meta: "⌘", ctrl: "⌃", alt: "⌥", shift: "⇧" }
const PC_MODIFIERS: Record<string, string> = { meta: "Win", ctrl: "Ctrl", alt: "Alt", shift: "Shift" }
const MODIFIER_OF: Record<string, string> = {
  meta: "meta", cmd: "meta", command: "meta",
  ctrl: "ctrl", control: "ctrl",
  alt: "alt", option: "alt",
  shift: "shift",
}
const NAMED: Record<string, string> = {
  click: "click",
  rightclick: "right-click",
  wheel: "wheel",
  escape: "Esc",
  enter: "Enter",
  tab: "Tab",
  " ": "Space",
  space: "Space",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
}

export function chordText(spec: string, mac = /mac|iphone|ipad/i.test(globalThis.navigator?.platform ?? "")): string {
  const parts = spec.split("+")
  const key = parts.pop() ?? ""
  if (key.length === 0) throw new Error(`invalid chord spec: ${spec}`)
  const names = mac ? MAC_MODIFIERS : PC_MODIFIERS
  const modifiers = parts.map((part) => {
    const lower = part.toLowerCase()
    const flag = lower === "mod" ? (mac ? "meta" : "ctrl") : MODIFIER_OF[lower]
    if (flag === undefined) throw new Error(`invalid chord spec: ${spec}`)
    return names[flag]!
  })
  const keyText = NAMED[key.toLowerCase()] ?? (key.length === 1 ? key.toUpperCase() : key)
  return [...modifiers, keyText].join(" + ")
}
