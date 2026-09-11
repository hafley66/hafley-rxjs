import { docsConfig, renderedOnly } from "@hafley66/docs-kit/config"
import { signalsJsx } from "@hafley66/signals/vite"
import { CONTENT } from "../content.js"

export default docsConfig({
  title: "signal-grid",
  description:
    "signal-grid: a relational data grid kernel. Two ordered forests, five pure operators, RxJS intents, signal derivation.",
  content: CONTENT,
  // `pnpm site:content` also drops the demo app's own readme at the site root, which the Showcase
  // group replaces, so it is excluded rather than built into an unlinked page.
  srcExclude: [renderedOnly(CONTENT), "demo-guide.md"],
  devPort: 5180,
  previewPort: 5181,
  vite: {
    // Three demos offer a React rendering, and `signalsJsx` rewrites the runtime import esbuild
    // emits for `examples/0_react.tsx`. The kit stays framework-free; this site does not have to.
    plugins: [signalsJsx()],
    esbuild: { jsx: "automatic", jsxImportSource: "react" },
  },
})
