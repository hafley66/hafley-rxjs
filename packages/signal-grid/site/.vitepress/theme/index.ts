import DefaultTheme from "vitepress/theme"
import { h } from "vue"
import type { Theme } from "vitepress"
import "../../../src/theme.css"
import "./site.css"
import ParityMatrix from "./ParityMatrix.vue"
import ReceiptsFooter from "./ReceiptsFooter.vue"
import ReceiptsSection from "./ReceiptsSection.vue"

const theme: Theme = {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "doc-after": () => h(ParityMatrix),
      "layout-bottom": () => h(ReceiptsFooter),
    }),
  enhanceApp({ app }) {
    app.component("ReceiptsSection", ReceiptsSection)
  },
}

export default theme
