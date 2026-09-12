import { docsConfig, renderedOnly } from "@hafley66/docs-kit/config"
import { CONTENT } from "../content.js"

export default docsConfig({
  title: "grapht",
  description:
    "Graph diagram toolkit: d2 and mermaid ingest into one canonical model, rendered by swappable adapters with an offline history journal.",
  content: CONTENT,
  // The `pages/` sources the content tree names; the rest of `pages/` is kept out of the build.
  srcExclude: [renderedOnly(CONTENT)],
  devPort: 5184,
  previewPort: 5185,
})
