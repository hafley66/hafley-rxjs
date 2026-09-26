import { expect, it } from "vitest"
import { chordText } from "./5a_chordText.js"

it("names each chord spec for a human, per platform", () => {
  const specs = ["RightClick", "Mod+Wheel", "Shift+Wheel", "Escape", "Mod+K", "Ctrl+Alt+Shift+ArrowDown", "Enter", "Meta+Click", " "]
  expect(Object.fromEntries(specs.map((spec) => [spec, { mac: chordText(spec, true), pc: chordText(spec, false) }]))).toMatchInlineSnapshot(`
    {
      " ": {
        "mac": "Space",
        "pc": "Space",
      },
      "Ctrl+Alt+Shift+ArrowDown": {
        "mac": "⌃ + ⌥ + ⇧ + ↓",
        "pc": "Ctrl + Alt + Shift + ↓",
      },
      "Enter": {
        "mac": "Enter",
        "pc": "Enter",
      },
      "Escape": {
        "mac": "Esc",
        "pc": "Esc",
      },
      "Meta+Click": {
        "mac": "⌘ + click",
        "pc": "Win + click",
      },
      "Mod+K": {
        "mac": "⌘ + K",
        "pc": "Ctrl + K",
      },
      "Mod+Wheel": {
        "mac": "⌘ + wheel",
        "pc": "Ctrl + wheel",
      },
      "RightClick": {
        "mac": "right-click",
        "pc": "right-click",
      },
      "Shift+Wheel": {
        "mac": "⇧ + wheel",
        "pc": "Shift + wheel",
      },
    }
  `)
  expect(() => chordText("Hyper+K", true)).toThrowErrorMatchingInlineSnapshot(`[Error: invalid chord spec: Hyper+K]`)
  expect(() => chordText("Mod+", true)).toThrowErrorMatchingInlineSnapshot(`[Error: invalid chord spec: Mod+]`)
})
