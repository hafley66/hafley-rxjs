import { docsConfig, renderedOnly } from "@hafley66/docs-kit/config"
import { signalsJsx } from "@hafley66/signals/vite"
import { CONTENT } from "../content.js"
import { boardEndpoints } from "../boardEndpoints.js"

export default docsConfig({
  title: "grapht",
  description:
    "Graph diagram toolkit: d2 and mermaid ingest into one canonical model, rendered by swappable adapters with an offline history journal.",
  content: CONTENT,
  // The `pages/` sources the content tree names; the rest of `pages/` is kept out of the build.
  srcExclude: [renderedOnly(CONTENT)],
  devPort: 5184,
  previewPort: 5185,
  // The board demo's file endpoint: `__board/<name>` under the site's base, so a drag on the page
  // is written to the real `notes.md.board.json` in the package's `out/`. `signalsJsx` redirects the
  // JSX runtime to `@hafley66/signals/jsx-runtime`, which wraps each component so a signal read
  // during render is a subscription: the board panel reads `host.placed()` and re-renders itself.
  vite: { plugins: [boardEndpoints(), signalsJsx()] },
})
