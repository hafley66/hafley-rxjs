// The React half of the flat list. The rows, the columns and the state seed arrive through `open`,
// which is the DOM twin's own factory, so the two panels differ in how they draw and in nothing else.
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import { SignalGrid } from "./0_react.js"
import type { AltRenderer } from "./0_types.js"
import { open } from "./1_flat_list.js"
import source from "./1_flat_list_react.tsx?raw"

export const flatListReact: AltRenderer = {
  label: "React",
  source,
  mount: (host) => {
    const root = document.createElement("div")
    root.style.blockSize = "320px"
    host.append(root)
    const g = open()
    // The observer in `SignalGrid` first reports a size on the frame after mount, and a zero-height
    // viewport windows no rows, so the box is measured before React draws anything.
    const box = root.getBoundingClientRect()
    g.viewport.$({ ...g.viewport.$(), width: box.width, height: box.height })
    const react = createRoot(root)
    // Synchronous, so the example check reads a painted tree on the frame after mount rather than on
    // whichever frame React's own scheduler picked.
    flushSync(() => react.render(<SignalGrid grid={g} />))
    return () => {
      react.unmount()
      g.close()
      root.remove()
    }
  },
}
