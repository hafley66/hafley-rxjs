import { docsConfig, renderedOnly } from "@hafley66/docs-kit/config"
import { CONTENT } from "../content.js"

export default docsConfig({
  title: "signals",
  description:
    "@hafley66/signals: RxJS-native reactive signals. One constructor, four forms, proxy-based nested access, and no value and onChange pair anywhere.",
  content: CONTENT,
  srcExclude: [renderedOnly(CONTENT)],
  devPort: 5182,
  previewPort: 5183,
})
